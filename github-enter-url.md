Errors in terminal when trying to analyze Github url:

INFO:     127.0.0.1:50848 - "GET /api/analysis/1bae33b3-104d-43f6-ba44-e18c9da0bbde/status HTTP/1.1" 200 OK
INFO:     127.0.0.1:50855 - "GET /api/analysis/1bae33b3-104d-43f6-ba44-e18c9da0bbde HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/protocols/http/httptools_impl.py", line 419, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/middleware/proxy_headers.py", line 84, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/applications.py", line 1054, in __call__
    await super().__call__(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/applications.py", line 113, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 187, in __call__
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 165, in __call__
    await self.app(scope, receive, _send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/cors.py", line 85, in __call__
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/exceptions.py", line 62, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 715, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 735, in app
    await route.handle(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 288, in handle
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 76, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 73, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 301, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 212, in run_endpoint_function
    return await dependant.call(**values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/api/routes.py", line 203, in get_analysis_result
    result = await db_service.get_analysis_result(analysis_id)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/services/database.py", line 232, in get_analysis_result
    owner=github_repo_data["owner"],
          ~~~~~~~~~~~~~~~~^^^^^^^^^
TypeError: string indices must be integers, not 'str'
INFO:     127.0.0.1:50858 - "GET /api/analysis/1bae33b3-104d-43f6-ba44-e18c9da0bbde/status HTTP/1.1" 200 OK
INFO:     127.0.0.1:50861 - "GET /api/analysis/1bae33b3-104d-43f6-ba44-e18c9da0bbde HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/protocols/http/httptools_impl.py", line 419, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/middleware/proxy_headers.py", line 84, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/applications.py", line 1054, in __call__
    await super().__call__(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/applications.py", line 113, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 187, in __call__
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 165, in __call__
    await self.app(scope, receive, _send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/cors.py", line 85, in __call__
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/exceptions.py", line 62, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 715, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 735, in app
    await route.handle(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 288, in handle
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 76, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 73, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 301, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 212, in run_endpoint_function
    return await dependant.call(**values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/api/routes.py", line 203, in get_analysis_result
    result = await db_service.get_analysis_result(analysis_id)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/services/database.py", line 232, in get_analysis_result
    owner=github_repo_data["owner"],
          ~~~~~~~~~~~~~~~~^^^^^^^^^
TypeError: string indices must be integers, not 'str'
INFO:     127.0.0.1:50864 - "GET /api/analysis/1bae33b3-104d-43f6-ba44-e18c9da0bbde/status HTTP/1.1" 200 OK
INFO:     127.0.0.1:50867 - "GET /api/analysis/1bae33b3-104d-43f6-ba44-e18c9da0bbde HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/protocols/http/httptools_impl.py", line 419, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/middleware/proxy_headers.py", line 84, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/applications.py", line 1054, in __call__
    await super().__call__(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/applications.py", line 113, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 187, in __call__
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 165, in __call__
    await self.app(scope, receive, _send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/cors.py", line 85, in __call__
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/exceptions.py", line 62, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 715, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 735, in app
    await route.handle(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 288, in handle
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 76, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 73, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 301, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 212, in run_endpoint_function
    return await dependant.call(**values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/api/routes.py", line 203, in get_analysis_result
    result = await db_service.get_analysis_result(analysis_id)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/services/database.py", line 232, in get_analysis_result
    owner=github_repo_data["owner"],
          ~~~~~~~~~~~~~~~~^^^^^^^^^
TypeError: string indices must be integers, not 'str'
INFO:     127.0.0.1:50874 - "GET /api/analysis/1bae33b3-104d-43f6-ba44-e18c9da0bbde HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/protocols/http/httptools_impl.py", line 419, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/uvicorn/middleware/proxy_headers.py", line 84, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/applications.py", line 1054, in __call__
    await super().__call__(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/applications.py", line 113, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 187, in __call__
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 165, in __call__
    await self.app(scope, receive, _send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/cors.py", line 85, in __call__
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/middleware/exceptions.py", line 62, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 715, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 735, in app
    await route.handle(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 288, in handle
    await self.app(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 76, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 62, in wrapped_app
    raise exc
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/_exception_handler.py", line 51, in wrapped_app
    await app(scope, receive, sender)
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/starlette/routing.py", line 73, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 301, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "/Users/maxbauer/Documents/visual-codebase/backend/venv/lib/python3.13/site-packages/fastapi/routing.py", line 212, in run_endpoint_function
    return await dependant.call(**values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/api/routes.py", line 203, in get_analysis_result
    result = await db_service.get_analysis_result(analysis_id)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/maxbauer/Documents/visual-codebase/backend/app/services/database.py", line 232, in get_analysis_result
    owner=github_repo_data["owner"],
          ~~~~~~~~~~~~~~~~^^^^^^^^^
TypeError: string indices must be integers, not 'str'