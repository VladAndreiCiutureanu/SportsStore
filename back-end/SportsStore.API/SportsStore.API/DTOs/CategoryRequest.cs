using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class CategoryRequest
    {
        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1023)]
        public string? Description { get; set; }
    }
}
