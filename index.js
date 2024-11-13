const WebSocket = require("ws");
const http = require("http");

const WS_URL = "wss://socket.india.delta.exchange";
const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let latestPrices = {}; // Store latest prices by symbol

// Function to fetch prices from Delta Exchange
function setupWebSocket(symbol) {
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log(`Connected to WebSocket for symbol: ${symbol}`);
    const subscribeMessage = JSON.stringify({
      type: "subscribe",
      payload: { channels: [{ name: "candlestick_1m", symbols: [symbol] }] },
    });
    ws.send(subscribeMessage);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.symbol === symbol && data.close) {
        latestPrices[symbol] = parseFloat(data.close);
        console.log(`Updated ${symbol} price: ${latestPrices[symbol]}`);

        // Broadcast to all clients interested in this symbol
        wss.clients.forEach((client) => {
          if (
            client.readyState === WebSocket.OPEN &&
            client.subscribedSymbol === symbol
          ) {
            client.send(
              JSON.stringify({ symbol, price: latestPrices[symbol] })
            );
          }
        });
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("error", (error) => console.error("WebSocket error:", error));
  ws.on("close", () =>
    console.log(`WebSocket connection for ${symbol} closed.`)
  );
}

// Start WebSocket for each symbol you want to track
const symbols = ["BTCUSD", "ETHUSD", "LTCUSD"]; // Add more symbols here
symbols.forEach((symbol) => setupWebSocket(symbol));

// Set up the server to listen for incoming connections
server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

// Handle client connections
wss.on("connection", (ws) => {
  console.log("New client connected");

  // Set a default message
  ws.send(
    JSON.stringify({
      message: "Welcome! Please specify a symbol to receive live updates.",
    })
  );

  // Listen for client messages to subscribe to a specific symbol
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.symbol && symbols.includes(data.symbol)) {
        ws.subscribedSymbol = data.symbol; // Store the client's subscribed symbol
        ws.send(
          JSON.stringify({ message: `Subscribed to ${data.symbol} updates.` })
        );

        // Send the latest price immediately upon subscription
        if (latestPrices[data.symbol]) {
          ws.send(
            JSON.stringify({
              symbol: data.symbol,
              price: latestPrices[data.symbol],
            })
          );
        }
      } else {
        ws.send(
          JSON.stringify({
            error: "Invalid symbol. Please send a valid symbol.",
          })
        );
      }
    } catch (error) {
      console.error("Error handling client message:", error);
      ws.send(JSON.stringify({ error: "Invalid message format." }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
