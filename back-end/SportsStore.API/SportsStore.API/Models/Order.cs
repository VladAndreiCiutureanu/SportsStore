using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SportsStore.API.Models
{
    public enum OrderStatus
    {
        PendingPayment,
        Paid,
        PaymentFailed,
        PaidNeedsReview,
        Cancelled
    }

    public class Order
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;
        public IdentityUser User { get; set; } = null!;

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

        [StringLength(32)]
        public string? Phone { get; set; }

        [Required]
        [StringLength(255)]
        public string DeliveryMethodName { get; set; } = string.Empty;

        [Precision(18, 2)]
        public decimal DeliveryCost { get; set; }

        [Precision(18, 2)]
        public decimal Subtotal { get; set; }

        [Precision(18, 2)]
        public decimal DiscountAmount { get; set; }

        [Precision(18, 2)]
        public decimal Total { get; set; }

        [StringLength(64)]
        public string? CouponCode { get; set; }
        public int? CouponId { get; set; }
        public Coupon? Coupon { get; set; }

        public OrderStatus Status { get; set; } = OrderStatus.PendingPayment;
        public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

        [StringLength(255)]
        public string? StripeCheckoutSessionId { get; set; }

        public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    }
}