import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { CategoryRepository } from './repositories/category.repository';
import { CreateCategoryDto, UpdateCategoryDto, CategoryDto } from './dto/category.dto';
import { Category } from './entities/category.entity';
import { CategoryFilters } from './repositories/category.repository.entity';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async findAll(filters: CategoryFilters) {
    const result = await this.categoryRepository.findWithFilters(filters);
    
    // Cargar hijas para cada categoría padre
    const categoriesWithChildren = await Promise.all(
      result.data.map(async (parent) => {
        const children = await this.categoryRepository.findChildrenByParentId(parent.id);
        return this.mapToDto(parent, children);
      })
    );

    return {
      ...result,
      data: categoriesWithChildren,
    };
  }

  async findOne(id: string): Promise<CategoryDto | null> {
    const category = await this.categoryRepository.findOne({ 
      where: { id },
      relations: ['parent', 'children']
    });
    
    if (!category) return null;
    
    // Si tiene hijas, cargarlas
    const children = category.children || [];
    return this.mapToDto(category, children);
  }

  async findByIds(ids: string[]): Promise<Category[]> {
    return await this.categoryRepository.findByIds(ids);
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryDto> {
    // Validar que el parentId existe si se proporciona
    if (createCategoryDto.parentId) {
      const parent = await this.categoryRepository.findOne({ 
        where: { id: createCategoryDto.parentId } 
      });
      
      if (!parent) {
        throw new BadRequestException(`Parent category with id "${createCategoryDto.parentId}" not found`);
      }
      
      // Validar que el padre no sea una categoría hija (solo 2 niveles)
      if (parent.parentId) {
        throw new BadRequestException('Cannot create a subcategory of a subcategory. Only 2 levels allowed.');
      }
    }

    // Validar nombre único por nivel (mismo nombre puede existir en diferentes niveles)
    const existingCategory = await this.categoryRepository.findOne({ 
      where: { 
        name: createCategoryDto.name,
        parentId: createCategoryDto.parentId || null
      } 
    });
    
    if (existingCategory) {
      throw new BadRequestException(`Category with name "${createCategoryDto.name}" already exists at this level`);
    }

    // If setting as default, ensure only one default exists
    if (createCategoryDto.default) {
      await this.ensureOnlyOneDefault(createCategoryDto.default);
    }

    const category = this.categoryRepository.create(createCategoryDto);
    const savedCategory = await this.categoryRepository.save(category);
    
    return this.mapToDto(savedCategory);
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryDto | null> {
    const existingCategory = await this.categoryRepository.findOne({ where: { id } });
    if (!existingCategory) {
      throw new NotFoundException('Category not found');
    }

    // Validar parentId si se está actualizando
    if (updateCategoryDto.parentId !== undefined) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      
      if (updateCategoryDto.parentId) {
        const parent = await this.categoryRepository.findOne({ 
          where: { id: updateCategoryDto.parentId } 
        });
        
        if (!parent) {
          throw new BadRequestException(`Parent category not found`);
        }
        
        // Validar que no se cree un ciclo
        if (parent.parentId) {
          throw new BadRequestException('Cannot set a subcategory as parent. Only 2 levels allowed.');
        }
        
        // Validar que la categoría a actualizar no tenga hijas (no puede convertirse en hija si tiene hijas)
        const hasChildren = await this.categoryRepository.countByParentId(id);
        
        if (hasChildren > 0) {
          throw new BadRequestException('Cannot convert a parent category into a child category. Remove children first.');
        }
      }
    }

    // Check if new name already exists (if name is being updated) - validar por nivel
    if (updateCategoryDto.name && updateCategoryDto.name !== existingCategory.name) {
      const newParentId = updateCategoryDto.parentId !== undefined 
        ? updateCategoryDto.parentId 
        : existingCategory.parentId;
      
      const nameExists = await this.categoryRepository.findOne({ 
        where: { 
          name: updateCategoryDto.name,
          parentId: newParentId || null
        } 
      });
      
      if (nameExists) {
        throw new BadRequestException(`Category with name "${updateCategoryDto.name}" already exists at this level`);
      }
    }

    // If setting as default, ensure only one default exists
    if (updateCategoryDto.default === true) {
      await this.ensureOnlyOneDefault(true, id);
    }

    await this.categoryRepository.update(id, updateCategoryDto);
    const updatedCategory = await this.categoryRepository.findOne({ 
      where: { id },
      relations: ['parent', 'children']
    });
    
    if (!updatedCategory) return null;
    
    const children = updatedCategory.children || [];
    return this.mapToDto(updatedCategory, children);
  }

  async remove(id: string): Promise<boolean> {
    const category = await this.categoryRepository.findOne({ 
      where: { id },
      relations: ['products']
    });
    
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category is being used by products
    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it is being used by ${category.products.length} product(s). ` +
        'Please remove this category from all products before deleting.'
      );
    }

    // Validar que no se elimine un padre si tiene hijas
    const hasChildren = await this.categoryRepository.countByParentId(id);
    
    if (hasChildren > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${hasChildren} subcategory(ies). ` +
        'Please delete or reassign all subcategories first.'
      );
    }

    // Check if this is the default category
    if (category.default) {
      const totalCategories = await this.categoryRepository.count({ active: true });
      if (totalCategories <= 1) {
        throw new BadRequestException(
          'Cannot delete the default category when it is the only active category. ' +
          'Please create another category and set it as default first.'
        );
      }
    }

    const result = await this.categoryRepository.delete(id);
    return result.affected > 0;
  }

  async getDefaultCategory(): Promise<CategoryDto | null> {
    const defaultCategory = await this.categoryRepository.findDefaultCategory();
    return defaultCategory ? this.mapToDto(defaultCategory) : null;
  }

  async ensureDefaultCategoryExists(): Promise<void> {
    const defaultCategory = await this.categoryRepository.findDefaultCategory();
    
    if (!defaultCategory) {
      // Create a default category if none exists
      const defaultCategoryData = {
        name: 'General',
        default: true,
        active: true,
      };
      
      const category = this.categoryRepository.create(defaultCategoryData);
      await this.categoryRepository.save(category);
      
      this.logger.log('✅ Created default category: General');
    }
  }

  private async ensureOnlyOneDefault(isDefault: boolean, excludeId?: string): Promise<void> {
    if (isDefault) {
      // Remove default flag from all other categories
      const queryBuilder = this.categoryRepository['repository']
        .createQueryBuilder()
        .update(Category)
        .set({ default: false })
        .where('default = :default', { default: true });
      
      if (excludeId) {
        queryBuilder.andWhere('id != :excludeId', { excludeId });
      }
      
      await queryBuilder.execute();
    }
  }

  private mapToDto(category: Category, children?: Category[]): CategoryDto {
    const dto: CategoryDto = {
      id: category.id,
      name: category.name,
      default: category.default,
      active: category.active,
      parentId: category.parentId || null,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };

    // Incluir hijas si se proporcionan
    if (children && children.length > 0) {
      dto.children = children.map(child => this.mapToDto(child));
    } else if (category.children && category.children.length > 0) {
      dto.children = category.children.map(child => this.mapToDto(child));
    } else {
      dto.children = [];
    }

    return dto;
  }
}