#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./deploy-sam.sh <dev|prod> [--profile AWS_PROFILE] [--s3-bucket BUCKET] [--no-build] [--no-container]

What it does:
  - Loads env vars from .env.development (dev) or .env.production (prod)
  - Builds the SAM artifact (default: with container for Lambda compatibility)
  - Deploys the stack with --parameter-overrides mapped from the .env file

Examples:
  ./deploy-sam.sh dev --profile sam-deployer-furia --s3-bucket furia-rock-sam-artifacts-dev
  ./deploy-sam.sh prod --profile sam-deployer-furia --s3-bucket furia-rock-sam-artifacts-prod
EOF
}

ENV_NAME=""
AWS_PROFILE_NAME=""
S3_BUCKET=""
NO_BUILD=0
NO_CONTAINER=0

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

ENV_NAME="$1"
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      AWS_PROFILE_NAME="${2:-}"
      if [[ -z "$AWS_PROFILE_NAME" ]]; then
        echo "Error: --profile requires a value" >&2
        exit 2
      fi
      shift 2
      ;;
    --s3-bucket)
      S3_BUCKET="${2:-}"
      if [[ -z "$S3_BUCKET" ]]; then
        echo "Error: --s3-bucket requires a value" >&2
        exit 2
      fi
      shift 2
      ;;
    --no-build)
      NO_BUILD=1
      shift
      ;;
    --no-container)
      NO_CONTAINER=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

case "$ENV_NAME" in
  dev)
    ENV_FILE=".env.development"
    STACK_NAME="furia-dev"
    DEFAULT_NODE_ENV="development"
    DEFAULT_ENABLE_SWAGGER="true"
    DEFAULT_S3_BUCKET="furia-rock-sam-artifacts-dev"
    ;;
  prod)
    ENV_FILE=".env.production"
    STACK_NAME="furia-prod"
    DEFAULT_NODE_ENV="production"
    DEFAULT_ENABLE_SWAGGER="false"
    DEFAULT_S3_BUCKET="furia-rock-sam-artifacts-prod"
    ;;
  *)
    echo "Error: Environment must be 'dev' or 'prod'" >&2
    usage
    exit 2
    ;;
esac

S3_BUCKET="${S3_BUCKET:-$DEFAULT_S3_BUCKET}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: Env file not found: $ENV_FILE" >&2
  echo "Tip: create it from .env.example" >&2
  exit 2
fi

# Load dotenv-style file.
# NOTE: This uses 'source' (shell evaluation). Keep your .env.* files as plain KEY=VALUE.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

NODE_ENV_VALUE="${NODE_ENV:-$DEFAULT_NODE_ENV}"
ENABLE_SWAGGER_VALUE="${ENABLE_SWAGGER:-$DEFAULT_ENABLE_SWAGGER}"

missing=()
req() {
  local k="$1"
  if [[ -z "${!k:-}" ]]; then
    missing+=("$k")
  fi
}

# Required by template (no defaults there)
req DB_HOST
req DB_USERNAME
req DB_PASSWORD
req DB_DATABASE
req JWT_SECRET
req ADMIN_PASSWORD
req CLOUDINARY_CLOUD_NAME
req CLOUDINARY_API_KEY
req CLOUDINARY_API_SECRET
req WOMPI_PUBLIC_KEY
req WOMPI_PRIVATE_KEY
req WOMPI_INTEGRITY_SECRET
req WOMPI_EVENTS_SECRET

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: Missing required env vars in $ENV_FILE:" >&2
  printf ' - %s\n' "${missing[@]}" >&2
  exit 2
fi

REGION_VALUE="${AWS_REGION:-us-east-2}"

overrides=(
  "NodeEnv=${NODE_ENV_VALUE}"
  "EnableSwagger=${ENABLE_SWAGGER_VALUE}"
  "DbHost=${DB_HOST}"
  "DbPort=${DB_PORT:-5432}"
  "DbUsername=${DB_USERNAME}"
  "DbPassword=${DB_PASSWORD}"
  "DbDatabase=${DB_DATABASE}"
  "JwtSecret=${JWT_SECRET}"
  "JwtExpires=${JWT_EXPIRES:-5d}"
  "AdminUsername=${ADMIN_USERNAME:-admin}"
  "AdminPassword=${ADMIN_PASSWORD}"
  "CloudinaryCloudName=${CLOUDINARY_CLOUD_NAME}"
  "CloudinaryApiKey=${CLOUDINARY_API_KEY}"
  "CloudinaryApiSecret=${CLOUDINARY_API_SECRET}"
  "CloudinaryFolder=${CLOUDINARY_FOLDER:-products}"
  "CloudinaryUrl=${CLOUDINARY_URL:-}"
  "FrontendUrl=${FRONTEND_URL:-}"
  "WompiPublicKey=${WOMPI_PUBLIC_KEY}"
  "WompiPrivateKey=${WOMPI_PRIVATE_KEY}"
  "WompiIntegritySecret=${WOMPI_INTEGRITY_SECRET}"
  "WompiEventsSecret=${WOMPI_EVENTS_SECRET}"
  "WompiBaseUrl=${WOMPI_BASE_URL:-}"
  "RedirectUrl=${REDIRECT_URL:-}"
  "SmtpHost=${SMTP_HOST:-}"
  "SmtpPort=${SMTP_PORT:-587}"
  "SmtpSecure=${SMTP_SECURE:-false}"
  "SmtpUser=${SMTP_USER:-}"
  "SmtpPass=${SMTP_PASS:-}"
  "SmtpFrom=${SMTP_FROM:-noreply@furia-rock.com}"
  "TelegramBotToken=${TELEGRAM_BOT_TOKEN:-}"
  "TelegramChatId=${TELEGRAM_CHAT_ID:-}"
  "ImageAspectRatio=${IMAGE_ASPECT_RATIO:-0.7}"
  "ImageAspectRatioTolerance=${IMAGE_ASPECT_RATIO_TOLERANCE:-0.05}"
  "ImageMinWidth=${IMAGE_MIN_WIDTH:-700}"
  "ImageMinHeight=${IMAGE_MIN_HEIGHT:-1000}"
  "ImageMaxWidth=${IMAGE_MAX_WIDTH:-4000}"
  "ImageMaxHeight=${IMAGE_MAX_HEIGHT:-6000}"
)

profile_args=()
if [[ -n "$AWS_PROFILE_NAME" ]]; then
  profile_args=("--profile" "$AWS_PROFILE_NAME")
fi

if [[ $NO_BUILD -eq 0 ]]; then
  if [[ $NO_CONTAINER -eq 0 ]]; then
    echo "Building with container (recommended for Lambda deps)..."
    sam build --use-container "${profile_args[@]}"
  else
    echo "Building without container..."
    sam build "${profile_args[@]}"
  fi
else
  echo "Skipping build (--no-build)."
fi

echo "Deploying stack '$STACK_NAME' to region '$REGION_VALUE' ($ENV_NAME)..."
echo "  S3 bucket : $S3_BUCKET"
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION_VALUE" \
  --s3-bucket "$S3_BUCKET" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "${overrides[@]}" \
  "${profile_args[@]}"
