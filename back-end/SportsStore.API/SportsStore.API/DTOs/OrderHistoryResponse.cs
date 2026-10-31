namespace SportsStore.API.DTOs
{
    public class OrderHistoryResponse
    {
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public List<OrderResponse> Items { get; set; } = new();
    }
}
