namespace MyApp.Records
{
    // C# 9+ record type for immutable data
    public record UserRecord(int Id, string Name, string Email);

    // Record with additional members
    public record CreateUserCommand(string Name, string Email)
    {
        public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    }
}
