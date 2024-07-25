We just send GET request to the server, which using event emitter waits until client will send POST request.
When it's happening from POST endpoint - is emitting appropriate event in order to retrieve data from "pending" GET request back to the client
