using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class DeliveryMethodRequest
    {
        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;
    }
}
