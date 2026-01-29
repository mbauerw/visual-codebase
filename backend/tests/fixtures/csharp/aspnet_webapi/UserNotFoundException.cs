using System;

namespace MyApp.Exceptions
{
    public class UserNotFoundException : Exception
    {
        public int UserId { get; }

        public UserNotFoundException(int userId)
            : base($"User not found with id: {userId}")
        {
            UserId = userId;
        }

        public UserNotFoundException(int userId, Exception innerException)
            : base($"User not found with id: {userId}", innerException)
        {
            UserId = userId;
        }
    }
}
