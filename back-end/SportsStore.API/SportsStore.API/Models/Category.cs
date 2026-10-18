using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.Models
{
    public class Category
    {
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1023)]
        public string? Description { get; set; }

        public ICollection<Product> Products { get; set; } = new List<Product>();
    }
}
