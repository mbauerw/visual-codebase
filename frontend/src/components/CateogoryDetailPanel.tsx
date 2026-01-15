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
