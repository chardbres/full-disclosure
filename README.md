# full-disclosure

design notes:

- caching is used to wrap the cik lookup function and recall the returned dict
- Session() is used to keep connection open and prevent a new connection/handshake to the server every time the function is called
