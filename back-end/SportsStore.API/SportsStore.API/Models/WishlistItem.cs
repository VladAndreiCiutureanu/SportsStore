using Microsoft.AspNetCore.Identity;

namespace SportsStore.API.Models
{
    public class WishlistItem
    {
        public string UserId { get; set; } = string.Empty;

        public IdentityUser User { get; set; } = null!;

        public int ProductId { get; set; }

        public Product Product { get; set; } = null!;
    }
}
