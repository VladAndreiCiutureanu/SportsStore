using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SportsStore.API.Database;
using SportsStore.API.DTOs;
using SportsStore.API.Models;

namespace SportsStore.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoryController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CategoryController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<CategoryResponse>>> GetCategories()
        {
            var categories = await _context.Categories
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .Select(c => new CategoryResponse
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description
                })
                .ToListAsync();

            return Ok(categories);
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<CategoryResponse>> GetCategory(int id)
        {
            var category = await _context.Categories
                .AsNoTracking()
                .Where(c => c.Id == id)
                .Select(c => new CategoryResponse
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description
                })
                .FirstOrDefaultAsync();
            if (category is null)
            {
                return NotFound();
            }
            return Ok(category);
        }


        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<CategoryResponse>> CreateCategory(CategoryRequest request)
        {
            var name = request.Name.Trim();

            var nameExists = await _context.Categories.AnyAsync(c => c.Name == name);

            if(nameExists)
            {
                return Conflict(new { message = $"Category with name '{name}' already exists." });
            }

            var category = new Category
            {
                Name = name,
                Description = request.Description?.Trim()
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            var response = new CategoryResponse
            {
                Id = category.Id,
                Name = category.Name,
                Description = category.Description
            };

            return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, response);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateCategory(int id, CategoryRequest request)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category is null)
            {
                return NotFound();
            }
            var name = request.Name.Trim();
            var nameExists = await _context.Categories.AnyAsync(c => c.Id != id && c.Name == name);
            if (nameExists)
            {
                return Conflict(new { message = $"Category with name '{name}' already exists." });
            }
            category.Name = name;
            category.Description = request.Description?.Trim();
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category is null)
            {
                return NotFound();
            }
            var hasProducts = await _context.Products.AnyAsync(p => p.CategoryId == id);
            if (hasProducts)
            {
                return Conflict(new { message = "Cannot delete category with associated products." });
            }
            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
