## terminal results

INFO:     127.0.0.1:61851 - "GET /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/file/9f90243b2dbd/content HTTP/1.1" 200 OK
[Rundown POST] Endpoint hit for b5060522-95e0-4549-8e89-af4fd1f4933f
[Rundown POST] Current status: {'status': 'generating'}
[Rundown POST] Stale 'generating' status, resetting...
[Rundown POST] set_rundown_status returned False (race condition)
INFO:     127.0.0.1:61888 - "POST /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/rundown HTTP/1.1" 200 OK
INFO:     127.0.0.1:61901 - "GET /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/rundown HTTP/1.1" 200 OK
INFO:     127.0.0.1:61913 - "GET /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/rundown HTTP/1.1" 200 OK
INFO:     127.0.0.1:61924 - "GET /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/rundown HTTP/1.1" 200 OK
INFO:     127.0.0.1:61935 - "GET /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/rundown HTTP/1.1" 200 OK
INFO:     127.0.0.1:61946 - "GET /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/rundown HTTP/1.1" 200 OK
INFO:     127.0.0.1:61957 - "GET /api/analysis/b5060522-95e0-4549-8e89-af4fd1f4933f/rundown HTTP/1.1" 200 OK
^CINFO:     Shutting down
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete.
INFO:     Finished server process [79864]
INFO:     Stopping reloader process [79862]