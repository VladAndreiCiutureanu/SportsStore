using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class DeliveryMethodRequest
    {
        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [Range(typeof(decimal), "0.00", "9999999999999999.99")]
        public decimal Cost { get; set; }
    }
}
