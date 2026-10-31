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
    public class ProductController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProductController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<ProductResponse>> GetProduct(int id)
        {
            var product = await _context.Products
                .AsNoTracking()
                .Include(product => product.Category)
                .Include(product => product.DeliveryMethods)
                .FirstOrDefaultAsync(product => product.Id == id);
            if (product is null)
            {
                return NotFound();
            }
            return Ok(ToResponse(product));
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ProductResponse>> CreateProduct(ProductRequest request)
        {
            var categoryExists = await _context.Categories.FindAsync(request.CategoryId);
            if (categoryExists is null)
            {
                return BadRequest($"Category with ID {request.CategoryId} does not exist.");
            }
            
            var deliveryMethodIds = request.DeliveryMethodIds.Distinct().ToList();

            if(deliveryMethodIds.Count != request.DeliveryMethodIds.Count) 
            {
                return BadRequest("Duplicate delivery method IDs are not allowed.");
            }

            var deliveryMethods = await _context.DeliveryMethods.Where(method => deliveryMethodIds.Contains(method.Id)).ToListAsync();

            if(deliveryMethods.Count != deliveryMethodIds.Count)
            {
                return BadRequest("One or more delivery method IDs are invalid.");
            }

            var product = new Product
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                Specifications = request.Specifications?.Trim(),
                Price = request.Price,
                Stock = request.Stock,
                Supplier = request.Supplier.Trim(),
                ImageUrl = request.ImageUrl?.Trim(),
                CategoryId = request.CategoryId,
                DeliveryMethods = deliveryMethods
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            var createdProduct = await _context.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Include(p => p.DeliveryMethods)
                .FirstAsync(p => p.Id == product.Id);

            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, ToResponse(createdProduct));
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateProduct(int id, ProductRequest request)
        {
            var product = await _context.Products
                .Include(p => p.DeliveryMethods)
                .FirstOrDefaultAsync(p => p.Id == id);
            if (product is null)
            {
                return NotFound();
            }
            var categoryExists = await _context.Categories.FindAsync(request.CategoryId);
            if (categoryExists is null)
            {
                return BadRequest($"Category with ID {request.CategoryId} does not exist.");
            }
            var deliveryMethodIds = request.DeliveryMethodIds.Distinct().ToList();
            if (deliveryMethodIds.Count != request.DeliveryMethodIds.Count)
            {
                return BadRequest("Duplicate delivery method IDs are not allowed.");
            }
            var deliveryMethods = await _context.DeliveryMethods.Where(method => deliveryMethodIds.Contains(method.Id)).ToListAsync();
            if (deliveryMethods.Count != deliveryMethodIds.Count)
            {
                return BadRequest("One or more delivery method IDs are invalid.");
            }
            product.Name = request.Name.Trim();
            product.Description = request.Description?.Trim();
            product.Specifications = request.Specifications?.Trim();
            product.Price = request.Price;
            product.Stock = request.Stock;
            product.Supplier = request.Supplier.Trim();
            product.ImageUrl = request.ImageUrl?.Trim();
            product.CategoryId = request.CategoryId;
            product.DeliveryMethods.Clear();
            foreach(var method in deliveryMethods)
            {
                product.DeliveryMethods.Add(method);
            }
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product is null)
            {
                return NotFound();
            }
            _context.Products.Remove(product);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<ProductResponse>>> GetProducts(
            [FromQuery] int? categoryId, 
            [FromQuery] string? search,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice,
            [FromQuery] bool? inStock,
            [FromQuery] int? minStock,
            [FromQuery] int? maxStock,
            [FromQuery] string? supplier,
            [FromQuery] List<int>? deliveryMethodIds)
        {
            if(minPrice.HasValue && minPrice.Value < 0)
            {
                return BadRequest("Minimum price cannot be negative.");
            }
            if(maxPrice.HasValue && maxPrice.Value < 0)
            {
                return BadRequest("Maximum price cannot be negative.");
            }
            if(minPrice.HasValue && maxPrice.HasValue && minPrice.Value > maxPrice.Value)
            {
                return BadRequest("Minimum price cannot be greater than maximum price.");
            }
            if(minStock.HasValue && minStock.Value < 0)
            {
                return BadRequest("Minimum stock cannot be negative.");
            }
            if(maxStock.HasValue && maxStock.Value < 0)
            {
                return BadRequest("Maximum stock cannot be negative.");
            }
            if(minStock.HasValue && maxStock.HasValue && minStock.Value > maxStock.Value)
            {
                return BadRequest("Minimum stock cannot be greater than maximum stock.");
            }
            var query = _context.Products
                .AsNoTracking()
                .Include(product => product.Category)
                .Include(product => product.DeliveryMethods)
                .AsQueryable();

            if (categoryId.HasValue)
            {
                query = query.Where(product => product.CategoryId == categoryId.Value);
            }

            if(!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(product =>
                        product.Name.ToLower().Contains(term) ||
                        (product.Description != null &&
                        product.Description.ToLower().Contains(term)) ||
                        (product.Specifications != null &&
                        product.Specifications.ToLower().Contains(term)));
            }

            if(minPrice.HasValue)
            {
                query = query.Where(product => product.Price >= minPrice.Value);
            }

            if(maxPrice.HasValue)
            {
                query = query.Where(product => product.Price <= maxPrice.Value);
            }

            if(inStock == true)
            {
                query = query.Where(product => product.Stock > 0);
            }
            else if (inStock == false)
            {
                query = query.Where(product => product.Stock == 0);
            }

            if(minStock.HasValue)
            {
                query = query.Where(product => product.Stock >= minStock.Value);
            }

            if(maxStock.HasValue)
            {
                query = query.Where(product => product.Stock <= maxStock.Value);
            }

            if(!string.IsNullOrWhiteSpace(supplier))
            {
                var supplierTerm = supplier.Trim().ToLower();
                query = query.Where(product => product.Supplier.ToLower().Contains(supplierTerm));
            }

            if(deliveryMethodIds is { Count: > 0 })
            {
                query = query.Where(product => product.DeliveryMethods.Any(method => deliveryMethodIds.Contains(method.Id)));
            }

            var products = await query.OrderBy(product => product.Name).ToListAsync();

            return Ok(products.Select(ToResponse));
        }


        private static ProductResponse ToResponse(Product product)
        {
            return new ProductResponse
            {
                Id = product.Id,
                Name = product.Name,
                Description = product.Description,
                Specifications = product.Specifications,
                Price = product.Price,
                Stock = product.Stock,
                Supplier = product.Supplier,
                ImageUrl = product.ImageUrl,
                CategoryId = product.CategoryId,
                CategoryName = product.Category.Name,
                DeliveryMethods = product.DeliveryMethods
                    .Select(method => new DeliveryMethodResponse
                    {
                        Id = method.Id,
                        Name = method.Name,
                        Cost = method.Cost
                    })
                    .ToList()
            };
        }

    }
}
