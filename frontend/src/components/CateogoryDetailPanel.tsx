import { X, FileCode, Folder, Hash, Code, Layers, ChevronsLeftRight, File } from 'lucide-react';
import { roleColors, roleLabels, languageColors } from '../types';
import { CategoryRoleData } from './CategoryNode';
import type { ArchitecturalRole } from '../types';

interface CategoryDetailPanelProps {
  data: CategoryRoleData | null;
  onClose: () => void;
  setExpand: React.Dispatch<React.SetStateAction<boolean>>;
  expanded?: boolean;
}

const roleDescriptions: Record<ArchitecturalRole, string> = {
  react_component: "React Components define reusable UI building blocks in React applications, encapsulating the visual presentation and user interaction logic. These components typically render JSX and manage their own local state or receive data through props. They can range from simple presentational components (like buttons or cards) to complex container components that orchestrate multiple child components. Components promote code reusability, maintainability, and separation of concerns in the user interface layer.",
  utility: "Utility files typically contain helper functions and shared logic that can be used across different parts of the application. These files contain pure functions or common operations like data formatting, validation, string manipulation, or date handling. Utilities don't typically have side effects and are designed to be easily testable and reusable. They help reduce code duplication and centralize common functionality that doesn't fit neatly into other architectural categories.",
  api_service: "Files in this category are responsible for handling communication with external APIs or backend services (services and datasources located outside the local codebase). They encapsulate HTTP requests, response handling, error management, and often include request/response transformations. API services provide a clean abstraction layer between the application logic and external data sources, making it easier to modify API endpoints or switch data sources without affecting the rest of the codebase. They typically use libraries like axios or fetch to make network requests.",
  model: "Model files define the data structures and business entities used throughout the application. Models represent the shape of data objects, often including type definitions, interfaces, or classes that describe entities like Users, Products, or Orders. They may also include methods for data validation, transformation, or business logic related to those entities. Models serve as a single source of truth for how data should be structured and manipulated.",
  config: "Configuration files that store application settings, environment variables, feature flags, and other constants. These files centralize configuration values that might change between environments (development, staging, production) or need to be easily modified without touching application logic. Configuration files help maintain flexibility and make it easier to deploy applications across different environments. They often include API endpoints, authentication keys, theme settings, or application-wide constants.",
  test: "Test files contain automated tests that verify the correctness of application code. These include unit tests (testing individual functions or components), integration tests (testing how parts work together), and end-to-end tests (testing complete user workflows). Test files help ensure code quality, catch bugs early, document expected behavior, and provide confidence when refactoring. They typically use testing frameworks like Jest, React Testing Library, or Cypress.",
  hook: "React hooks are the functions that allow your components to store and react to data. They define how and went your components should change, and provide avenues that allow your components to automatically adjust to external changes. Hooks allow you to extract component logic into reusable functions, following React's composition model and the rules of hooks. They can manage local state, subscribe to external data sources, handle form logic, or orchestrate complex interactions. Custom hooks promote code reuse across components without the need for higher-order components or render props patterns.",
  context: "Context files implement React's Context API for sharing data across the component tree without prop drilling. Context providers make values available to all descendant components, useful for global state like authentication, themes, or localization. They help avoid passing props through many intermediate components and provide a centralized way to manage cross-cutting concerns. Context is often combined with hooks to create powerful state management solutions.",
  store: "Store files define state management logic, typically using libraries like Redux, Zustand, or MobX. Stores centralize application state and provide predictable ways to read and update that state through actions and reducers. They help manage complex state that needs to be accessed across multiple components or persisted across user sessions. Stores promote a unidirectional data flow and make state changes more traceable and debuggable.",
  middleware: "Middleware is almost exactly what it sounds like: the stuff that operates between various independent parts of an application, ensuring proper communication and enforcing specific rules, such as formatting and rate limiting. They contain functions that intercept and process requests/responses in a pipeline. In backend contexts, middleware handles cross-cutting concerns like authentication, logging, error handling, or request validation before requests reach controllers. In state management, middleware can intercept actions before they reach reducers to perform logging, async operations, or other side effects. Middleware promotes separation of concerns and code reusability for common processing tasks.",
  controller: "Controller files handle incoming requests and coordinate the application's response in MVC (Model-View-Controller) architectures. Controllers receive user input, invoke appropriate business logic or services, and determine what response to send back. They act as intermediaries between the routing layer and the business logic, keeping route handlers thin and focused. Controllers help organize code by grouping related request handlers together.",
  router: "Router files define the application's routing configuration, mapping URLs or paths to specific handlers or components. In frontend applications, routers determine which components to render based on the current URL. In backend applications, they define API endpoints and map them to controller functions. Routers provide the navigation structure for applications and often include features like route guards, parameter extraction, and nested routes.",
  schema: "Schemas define the structure and validation rules for data, often using libraries like Zod, Yup, or JSON Schema. Schemas specify the expected shape of data, including field types, constraints, and relationships between fields. They're used for runtime validation, type generation, database modeling, or API contract definitions. Schemas provide a single source of truth for data structure and help ensure data integrity across the application.",
  // Java/C# specific roles
  entity: "Entity files define persistent domain objects that map to database tables, typically using ORM frameworks like JPA/Hibernate (Java) or Entity Framework (C#). Entities represent core business concepts with their properties and relationships, often including validation annotations and lifecycle callbacks. They form the foundation of the data layer and enable object-relational mapping for database operations.",
  repository: "Repository files provide data access abstraction, encapsulating database operations behind a clean interface. In Spring Data or EF Core, repositories offer standard CRUD operations plus custom query methods. They decouple business logic from data persistence details, making it easier to switch databases or test with mock data. Repositories follow the Repository pattern to centralize data access logic.",
  service: "Service files contain business logic and orchestrate operations across multiple repositories or external services. They implement use cases and enforce business rules, sitting between controllers and repositories. Services handle transactions, validation, and complex workflows. They promote code reuse and maintain separation between presentation and data layers.",
  dto: "Data Transfer Objects (DTOs) are simple objects used to transfer data between layers or systems. DTOs define the shape of data for API requests/responses, separate from internal domain models. They help control what data is exposed externally, support versioning, and can include validation rules. DTOs decouple internal representations from external contracts.",
  exception: "Exception files define custom error types for specific failure scenarios in the application. Custom exceptions provide meaningful error information, enable precise error handling, and support consistent error responses. They typically extend base exception classes and may include error codes, context data, or HTTP status mappings for API responses.",
  enum_type: "Enum files define fixed sets of named constants representing discrete values like statuses, types, or categories. Enums provide type safety, self-documenting code, and prevent invalid values. They often include associated data or behavior methods in languages that support rich enums. Enums centralize constant definitions and make code more maintainable.",
  interface: "Interface files define contracts specifying method signatures and properties that implementing classes must provide. Interfaces enable polymorphism, dependency injection, and loose coupling between components. They support the programming-to-interfaces principle, making code more testable and flexible. Interfaces often define service boundaries or plugin points.",
  annotation: "Annotation files (Java) or Attribute files (C#) define custom metadata that can be attached to code elements. They enable declarative programming for concerns like validation, serialization, dependency injection, or aspect-oriented programming. Custom annotations encapsulate cross-cutting logic and integrate with framework processing mechanisms.",
  // C# specific roles
  extension: "Extension method files add new methods to existing types without modifying their source code. Extensions enable fluent APIs, add utility methods to framework types, and support LINQ-style programming. They're static methods that appear as instance methods on the extended type, promoting code reuse and cleaner syntax.",
  record: "Record files define immutable reference types with value-based equality semantics. Records are ideal for DTOs, event payloads, and domain objects where immutability is desired. They provide concise syntax for properties, built-in equality comparisons, and support pattern matching. Records promote functional programming patterns in C#.",
  delegate: "Delegate files define type-safe function pointers, specifying method signatures that can be passed as parameters or stored. Delegates enable callback patterns, event handling, and functional programming. They're the foundation for events, LINQ, and async patterns, allowing methods to be treated as first-class objects.",
  // Go specific roles
  go_handler: "Handler files in Go contain HTTP handler functions that process incoming web requests. They parse request parameters, invoke business logic, and format responses. Handlers typically implement the http.Handler interface or use framework-specific patterns. They're often organized by resource or domain area and kept thin, delegating to services.",
  go_middleware: "Middleware files in Go contain functions that wrap HTTP handlers to add cross-cutting functionality. Common middleware handles logging, authentication, CORS, rate limiting, or request tracing. Go middleware follows the decorator pattern, creating chains of handlers. They promote code reuse and separation of concerns in web applications.",
  go_repository: "Repository files in Go provide data access abstraction, typically defining interfaces and their implementations for database operations. They encapsulate SQL queries, ORM usage, or external data source access. Go repositories often return domain types and handle connection pooling. They enable dependency injection and testability.",
  go_service: "Service files in Go contain business logic and coordinate operations across multiple repositories or external APIs. They implement use cases, enforce business rules, and manage transactions. Services are typically defined as interfaces with struct implementations, promoting testability and clean architecture principles.",
  go_model: "Model files in Go define data structures representing domain entities, typically as structs with JSON/DB tags. They may include validation methods, constructors, and domain logic. Models define the core data types used throughout the application and often map to database tables or API contracts.",
  go_cmd: "Cmd files in Go contain main package entry points for executable programs. Following Go project layout conventions, cmd/ directories hold application binaries. These files initialize dependencies, configure the application, and start servers or CLI tools. Each subdirectory typically represents a separate executable.",
  go_pkg: "Pkg files in Go contain reusable packages intended for use by external applications. Following Go project layout conventions, pkg/ holds library code that's safe to import. These packages are stable, well-documented, and follow Go best practices for public APIs.",
  go_internal: "Internal package files in Go contain private implementation details not meant for external import. The internal/ directory convention prevents external packages from importing these modules. This enforces encapsulation and allows refactoring without breaking external consumers.",
  go_transport: "Transport files in Go handle communication protocols like HTTP, gRPC, or message queues. They define request/response types, encode/decode logic, and protocol-specific error handling. Transport layers adapt between external protocols and internal service interfaces, often using generated code for protocols like gRPC.",
  go_config: "Config files in Go handle application configuration loading from environment variables, files, or remote sources. They define config structs, parsing logic, and validation. Go config packages often use libraries like Viper or envconfig to support multiple sources and type-safe access.",
  go_util: "Util files in Go contain helper functions and shared utilities used across the codebase. They include common operations like string manipulation, time formatting, or error wrapping. Go util packages are kept minimal and focused, avoiding becoming catch-all dumping grounds.",
  // Rust specific roles
  rust_lib: "Library files in Rust (lib.rs) define the public API of a crate, exporting modules and types for external use. They organize the crate structure, re-export items, and configure crate-level attributes. Library roots are the entry point for crate consumers and define what's publicly accessible.",
  rust_bin: "Binary files in Rust (main.rs or bin/*.rs) contain executable entry points. They initialize the application, parse CLI arguments, and orchestrate the main program flow. Binary crates depend on library crates for logic, keeping main files focused on setup and execution.",
  rust_mod: "Module files in Rust (mod.rs or named modules) organize code into hierarchical namespaces. They control visibility, re-export items, and structure the crate. Modules enable encapsulation and logical grouping of related functionality, following Rust's privacy and visibility rules.",
  rust_trait: "Trait files in Rust define shared behavior through method signatures that types can implement. Traits enable polymorphism, generic programming, and the trait object pattern. They're similar to interfaces but can include default implementations and associated types. Traits are fundamental to Rust's type system.",
  rust_impl: "Implementation files in Rust contain impl blocks that add methods to structs, enums, or implement traits. They define type behavior, both inherent and through trait implementations. Impl files may be organized by type or by trait, depending on project conventions.",
  rust_handler: "Handler files in Rust process incoming requests in web frameworks like Actix-web, Axum, or Rocket. They parse parameters, invoke services, and return responses. Handlers are async functions or types implementing framework traits, organized by route or resource.",
  rust_error: "Error files in Rust define custom error types, typically implementing std::error::Error and supporting error conversion. They enable the ? operator for error propagation and provide meaningful error context. Error types often use thiserror or anyhow for ergonomic definitions.",
  rust_macro: "Macro files in Rust define compile-time code generation using declarative (macro_rules!) or procedural macros. They reduce boilerplate, enable DSLs, and extend the language. Procedural macros for derives, attributes, and function-like macros live in separate crates.",
  rust_types: "Type definition files in Rust contain structs, enums, type aliases, and associated type definitions. They define the data structures used throughout the crate, often with derive macros for common traits. Type files establish the domain model and data contracts.",
  rust_tests: "Test files in Rust contain unit tests (in #[cfg(test)] modules), integration tests (in tests/), and documentation tests. They verify correctness using the built-in test framework with #[test] attributes. Test organization follows Rust conventions for unit vs integration testing.",
  // Swift/iOS specific roles
  swift_view_controller: "View Controller files in Swift/UIKit manage a screen's view hierarchy and lifecycle. They handle user interactions, coordinate with models and services, and manage navigation. View controllers are central to UIKit apps, though SwiftUI is reducing their usage. They implement the UIViewController lifecycle methods.",
  swift_ui_view: "SwiftUI View files define declarative UI components using Swift's result builder syntax. Views are structs conforming to the View protocol, describing UI through their body property. They're composable, reactive to state changes, and support previews. SwiftUI views replace much traditional UIKit code.",
  swift_app_delegate: "App Delegate files in Swift handle application lifecycle events and global setup. They manage launch, backgrounding, push notifications, and deep links. In modern iOS with SwiftUI, AppDelegate is often replaced or supplemented by the App protocol and scene-based lifecycle.",
  swift_protocol: "Protocol files in Swift define contracts specifying required methods, properties, and associated types. Protocols enable polymorphism, dependency injection, and protocol-oriented programming. Swift protocols can have default implementations via extensions and support associated types for generics.",
  swift_extension: "Extension files in Swift add functionality to existing types without subclassing. They can add methods, computed properties, protocol conformances, and nested types. Extensions enable code organization, retroactive modeling, and protocol-oriented design patterns.",
  swift_coordinator: "Coordinator files in Swift implement the Coordinator pattern for navigation management. Coordinators handle flow logic, screen transitions, and dependency injection for view controllers. They decouple navigation from view controllers, improving testability and reusability.",
  swift_view_model: "View Model files in Swift implement the MVVM pattern, preparing data for display and handling user actions. They expose observable properties for view binding, typically using Combine or ObservableObject. View models contain presentation logic while keeping views simple.",
  swift_data_source: "Data Source files in Swift provide data to collection views and table views through delegate protocols. They implement UITableViewDataSource or UICollectionViewDataSource, managing sections, cells, and updates. Modern alternatives include diffable data sources and compositional layouts.",
  swift_network_service: "Network Service files in Swift handle API communication using URLSession, Alamofire, or similar. They manage requests, response parsing, authentication, and error handling. Network services often use Combine or async/await for asynchronous operations and provide typed API interfaces.",
  swift_core_data: "Core Data files in Swift interact with Apple's persistence framework for local data storage. They include managed object subclasses, fetch request definitions, and Core Data stack setup. These files handle the object graph, migrations, and persistence coordination.",
  swift_observable: "Observable files in Swift define reactive state containers using Combine's ObservableObject or the new Observation framework. They publish state changes that SwiftUI views automatically observe. Observable objects are central to SwiftUI's data flow architecture.",
  unknown: "Files that don't fit into any predefined architectural categories. These could be miscellaneous files, third-party integrations, or new types of files that haven't been classified yet. The 'unknown' category serves as a catch-all for files that require further analysis or categorization. It helps identify areas of the codebase that may need additional attention or restructuring to align with established architectural patterns.",
};

export default function CategoryDetailPanel({ data, onClose, setExpand, expanded }: CategoryDetailPanelProps) {
  const handleExpandToggle = () => {
    console.log("Toggling expand state");
    setExpand(prev => !prev);
  }

  //  ${expanded ? 'w-full' : 'w-[50px]'} transition-all duration-1000 

  if (!data) {
    return (
      <div className={`h-screen w-full fixed relative flex flex-col items-center justify-center p-8 text-center`}>
        <div className='absolute top-2 left-2 flex items-center cursor-pointer gap-2 text-slate-400 z-50 ' >
          <ChevronsLeftRight size={26} onMouseDown={handleExpandToggle} className='z-50 pointer-events-all' />
          {/* <span className="text-sm uppercase tracking-wider font-semibold">Node Details</span> */}
        </div>
        {expanded &&
          <div className='flex flex-col items-center justify-center'>
            <div className="p-6 bg-slate-800/50 w-[96px] rounded-2xl border border-slate-700/50 mb-4">
              <Layers size={48} className="text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-400 mb-2">No File Selected</h3>
            <p className="text-sm text-slate-500 max-w-[200px]">
              Click on a file node in the visualization to view its details
            </p>
          </div>

        }

      </div>
    );
  }


  const roleColor = roleColors[data.role] || roleColors.unknown;

  return (
    <div className="h-full w-full flex flex-col overflow-y-auto">

      {/* Header with gradient accent */}
      <div className="relative">
        {/* <button
        onClick={onClose}
        className="p-2 absolute right-2 top-0 hover:bg-slate-700 rounded-xl transition-all duration-200 hover:scale-105 flex-shrink-0"
      >
        <X size={18} className="text-slate-400" />
      </button> */}

        <div className="p-6 ">
          <div className="flex flex-col items-center justify-center gap-8 relative">
            <p className="text-xl text-center text-slate-500">Category Details</p>

            <div className="flex flex-col items-center gap-4 min-w-0">
              <span
                className="px-8 py-4 rounded-full font-semibold border transition-transform hover:scale-105"
                style={{
                  backgroundColor: `${roleColor}35`,
                  color: roleColor,
                  borderColor: `${roleColor}70`,
                }}
              >
                <h2 className="text-5xl font-bold text-wrap text-center" title={data.label}>
                  {data.label}
                </h2>

              </span>
            </div>

          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6  [-ms-overflow-style:none] [scrollbar-width:none]">

        {/* Description */}
        {data.role && (
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
            <label className="text-lg text-slate-400 uppercase tracking-wider font-semibold mb-3 block">
              Description
            </label>
            <p className="text-slate-300 text-md leading-relaxed">{roleDescriptions[data.role]}</p>
          </div>
        )}

        {/* Files Table */}
        {data.files && data.files.length > 0 && (
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-400">
                <File size={16} />
                <span className="text-xs uppercase tracking-wider font-semibold">Files</span>
              </div>
              <span className="text-xs bg-slate-700/50 text-slate-400 px-2.5 py-1 rounded-full font-medium">
                {data.files.length}
              </span>
            </div>

            {/* Scrollable Table Container */}
            <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-xs text-slate-400 uppercase tracking-wider">
                    <th className="text-left py-2 px-2 font-semibold">File</th>
                    <th className="text-left py-2 px-2 font-semibold">Language</th>
                    <th className="text-right py-2 px-2 font-semibold">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {data.files.map((file, index) => {
                    const langColor = languageColors[file.language] || languageColors.unknown;
                    return (
                      <tr
                        key={index}
                        className="border-t border-slate-700/30 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-2.5 px-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-200 font-medium truncate" title={file.label}>
                              {file.label}
                            </span>
                            <span className="text-xs text-slate-500 truncate" title={file.path}>
                              {file.folder}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${langColor}15`,
                              color: langColor,
                            }}
                          >
                            {file.language}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-300">
                          {file.line_count.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {/* <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-5 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                <Hash size={14} className="text-indigo-400" />
              </div>
              <span className="text-xs uppercase tracking-wider font-semibold">Lines</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-5 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <div className="p-1.5 bg-purple-500/20 rounded-lg">
                <Code size={14} className="text-purple-400" />
              </div>
              <span className="text-xs uppercase tracking-wider font-semibold">Size</span>
            </div>

          </div>
        </div> */}

        {/* Imports Section */}

      </div>
    </div >
  );
}
