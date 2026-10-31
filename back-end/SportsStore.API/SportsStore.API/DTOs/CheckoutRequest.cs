using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class CheckoutRequest
    {
        [Required]
        [StringLength(255)]
        public string RecipientName { get; set; } = string.Empty;

        [Required]
        [StringLength(255)]
        public string AddressLine1 { get; set; } = string.Empty;

        [StringLength(255)]
        public string? AddressLine2 { get; set; }

        [Required]
        [StringLength(120)]
        public string City { get; set; } = string.Empty;

        [StringLength(120)]
        public string? Region { get; set; }

        [Required]
        [StringLength(32)]
        public string PostalCode { get; set; } = string.Empty;

        [Required]
        [StringLength(2, MinimumLength = 2)]
        public string CountryCode { get; set; } = string.Empty;

        [Phone]
        [StringLength(32)]
        public string? Phone { get; set; }

        [Range(1, int.MaxValue)]
        public int DeliveryMethodId { get; set; }

        [StringLength(64)]
        public string? CouponCode { get; set; }
    }
}