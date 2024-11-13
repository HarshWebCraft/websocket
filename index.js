const WebSocket = require("ws");
const http = require("http");

const WS_URL = "wss://socket.india.delta.exchange";
const PORT = 8080;

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

        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
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
  ws.on("close", () => console.log("WebSocket connection closed."));
}

// Start WebSocket for each symbol you want to track
setupWebSocket("BTCUSD"); // Replace with the desired symbol(s)

// Set up the server to listen for incoming connections
server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

wss.on("connection", (ws) => {
  console.log("New client connected");
  ws.send(
    JSON.stringify({ message: "Welcome! You will receive live price updates." })
  );

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
