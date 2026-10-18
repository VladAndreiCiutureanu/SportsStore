using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class LoginRequest
    {
        [Required]
        [StringLength(255, MinimumLength = 3)]
        public string UsernameOrEmail { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Password { get; set; } = string.Empty;
    }
}
