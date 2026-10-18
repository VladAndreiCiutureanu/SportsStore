using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.Models
{
    public class DeliveryMethod
    {
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        public ICollection<Product> Products { get; set; } = new List<Product>();
    }
}
