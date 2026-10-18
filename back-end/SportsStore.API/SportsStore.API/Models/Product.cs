using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.Models
{
    public class Product
    {
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1023)]
        public string? Description { get; set; }

        [StringLength(1023)]
        public string? Specifications { get; set; }

        [Precision(18, 2)]
        [Range(typeof(decimal), "0.01", "9999999999999999.99")]
        public decimal Price { get; set; }

        [Range(0, int.MaxValue)]
        public int Stock { get; set; }

        [Required]
        [StringLength(255)]
        public string Supplier { get; set; } = string.Empty;

        public string? ImageUrl { get; set; }

        public int CategoryId { get; set; }

        public Category Category { get; set; } = null!;

        public ICollection<DeliveryMethod> DeliveryMethods { get; set; } = new List<DeliveryMethod>();
    }
}
