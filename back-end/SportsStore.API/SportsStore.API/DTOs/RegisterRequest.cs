using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class RegisterRequest
    {
        [Required]
        [StringLength(255, MinimumLength = 3)]
        public string Username { get; set; } = string.Empty;
        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Password { get; set; } = string.Empty;
    }
}
