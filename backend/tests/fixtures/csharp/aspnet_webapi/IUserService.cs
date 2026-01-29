using System.Collections.Generic;
using System.Threading.Tasks;

using MyApp.Dto;

namespace MyApp.Services
{
    public interface IUserService
    {
        Task<IEnumerable<UserDto>> GetAllAsync();
        Task<UserDto?> GetByIdAsync(int id);
        Task<UserDto> CreateAsync(CreateUserRequest request);
        Task<bool> DeleteAsync(int id);
    }
}
