#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./deploy-sam.sh <dev|prod> [--profile AWS_PROFILE] [--s3-bucket BUCKET] [--no-build] [--no-container]

What it does:
  1) Loads env vars from .env.development (dev) or .env.production (prod)
  2) Runs idempotent DB migration for order expiration fields/indexes
  3) Builds the SAM artifacts (default: with container for Lambda compatibility)
  4) Deploys the stack with --parameter-overrides mapped from the .env file
  5) Verifies post-deploy resources (expire-orders Lambda + Scheduler V2)

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

if [[ ! -f "scripts/migrate-order-expiration.js" ]]; then
  echo "Error: migration script not found: scripts/migrate-order-expiration.js" >&2
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
  "ResendApiKey=${RESEND_API_KEY:-}"
  "ResendFrom=${RESEND_FROM:-onboarding@resend.dev}"
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

aws_cli_args=("--region" "$REGION_VALUE")
if [[ -n "$AWS_PROFILE_NAME" ]]; then
  aws_cli_args+=("--profile" "$AWS_PROFILE_NAME")
fi

echo "Running DB migration for order expiration..."
node scripts/migrate-order-expiration.js

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

echo "Running post-deploy verification..."

EXPIRE_FUNCTION_NAME="${STACK_NAME}-expire-pending-orders"

aws "${aws_cli_args[@]}" lambda get-function \
  --function-name "$EXPIRE_FUNCTION_NAME" \
  >/dev/null
echo "  OK Lambda exists: $EXPIRE_FUNCTION_NAME"

RAW_SCHEDULE_ID="$(aws "${aws_cli_args[@]}" cloudformation list-stack-resources \
  --stack-name "$STACK_NAME" \
  --query "StackResourceSummaries[?ResourceType=='AWS::Scheduler::Schedule'] | [0].PhysicalResourceId" \
  --output text)"

if [[ -z "$RAW_SCHEDULE_ID" || "$RAW_SCHEDULE_ID" == "None" ]]; then
  echo "Error: No AWS::Scheduler::Schedule resource found in stack '$STACK_NAME'" >&2
  exit 1
fi

SCHEDULE_GROUP="default"
SCHEDULE_NAME="$RAW_SCHEDULE_ID"

if [[ "$RAW_SCHEDULE_ID" == arn:* ]]; then
  schedule_path="${RAW_SCHEDULE_ID##*:schedule/}"
  SCHEDULE_GROUP="${schedule_path%%/*}"
  SCHEDULE_NAME="${schedule_path##*/}"
elif [[ "$RAW_SCHEDULE_ID" == */* ]]; then
  SCHEDULE_GROUP="${RAW_SCHEDULE_ID%%/*}"
  SCHEDULE_NAME="${RAW_SCHEDULE_ID##*/}"
fi

echo "  OK Scheduler exists: $SCHEDULE_NAME"

SCHEDULE_EXPRESSION="$(aws "${aws_cli_args[@]}" scheduler get-schedule \
  --group-name "$SCHEDULE_GROUP" \
  --name "$SCHEDULE_NAME" \
  --query "ScheduleExpression" \
  --output text)"

SCHEDULE_STATE="$(aws "${aws_cli_args[@]}" scheduler get-schedule \
  --group-name "$SCHEDULE_GROUP" \
  --name "$SCHEDULE_NAME" \
  --query "State" \
  --output text)"

SCHEDULE_RETRY_ATTEMPTS="$(aws "${aws_cli_args[@]}" scheduler get-schedule \
  --group-name "$SCHEDULE_GROUP" \
  --name "$SCHEDULE_NAME" \
  --query "Target.RetryPolicy.MaximumRetryAttempts" \
  --output text)"

SCHEDULE_MAX_EVENT_AGE="$(aws "${aws_cli_args[@]}" scheduler get-schedule \
  --group-name "$SCHEDULE_GROUP" \
  --name "$SCHEDULE_NAME" \
  --query "Target.RetryPolicy.MaximumEventAgeInSeconds" \
  --output text)"

if [[ "$SCHEDULE_EXPRESSION" != "rate(7 days)" ]]; then
  echo "Error: Scheduler expression is '$SCHEDULE_EXPRESSION' (expected 'rate(7 days)')" >&2
  exit 1
fi

if [[ "$SCHEDULE_STATE" != "ENABLED" ]]; then
  echo "Error: Scheduler state is '$SCHEDULE_STATE' (expected 'ENABLED')" >&2
  exit 1
fi

if [[ "$SCHEDULE_RETRY_ATTEMPTS" != "0" ]]; then
  echo "Error: Scheduler MaximumRetryAttempts is '$SCHEDULE_RETRY_ATTEMPTS' (expected '0')" >&2
  exit 1
fi

if [[ "$SCHEDULE_MAX_EVENT_AGE" != "60" ]]; then
  echo "Error: Scheduler MaximumEventAgeInSeconds is '$SCHEDULE_MAX_EVENT_AGE' (expected '60')" >&2
  exit 1
fi

echo "  OK Scheduler config: expression=$SCHEDULE_EXPRESSION state=$SCHEDULE_STATE retries=$SCHEDULE_RETRY_ATTEMPTS maxEventAge=$SCHEDULE_MAX_EVENT_AGE"
echo "Deploy completed successfully for '$STACK_NAME'."
