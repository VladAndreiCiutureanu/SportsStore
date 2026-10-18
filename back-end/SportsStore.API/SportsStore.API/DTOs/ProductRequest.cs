using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class ProductRequest
    {
        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1023)]
        public string? Description { get; set; }

        [StringLength(1023)]
        public string? Specifications { get; set; }

        [Range(typeof(decimal), "0.01", "9999999999999999.99")]
        public decimal Price { get; set; }

        [Range(0, int.MaxValue)]
        public int Stock { get; set; }

        [Required]
        [StringLength(255)]
        public string Supplier { get; set; } = string.Empty;

        public string? ImageUrl { get; set; }

        [Range(1, int.MaxValue)]
        public int CategoryId { get; set; }

        public List<int> DeliveryMethodIds { get; set; } = new List<int>();

    }
}
