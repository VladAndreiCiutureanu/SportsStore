using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace SportsStore.API.Models
{
    public class DeliveryMethod
    {
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [Precision(18, 2)]
        [Range(typeof(decimal), "0.00", "9999999999999999.99")]
        public decimal Cost { get; set; }

        public ICollection<Product> Products { get; set; } = new List<Product>();
    }
}
