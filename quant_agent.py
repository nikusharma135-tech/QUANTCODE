import os
import yfinance as yf
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv() # This magically loads the hidden .env file!

app = Flask(__name__)
CORS(app) 

genai.configure(api_key=os.getenv("AIzaSyCHElJaf9MO05VI5-DOZAipN5h2XbPDTA4EY"))

def get_stock_price(ticker: str) -> str:
    """Fetches the current live stock price for a given ticker symbol. Use .NS for India."""
    try:
        print(f"   [⚙️ Agent Tool Executed: Fetching {ticker}]")
        stock = yf.Ticker(ticker)
        price = round(stock.history(period="1d")['Close'].iloc[-1], 2)
        return f"The current price of {ticker} is ₹{price}"
    except Exception as e:
        return f"Could not fetch data for {ticker}."

model = genai.GenerativeModel(model_name='gemini-2.5-flash', tools=[get_stock_price])

# --- 3. CREATE THE API ENDPOINT ---
@app.route('/api/ask-agent', methods=['POST'])
def ask_agent():
    # Read the question sent from the website
    data = request.json
    user_query = data.get("query")
    print(f"\n[USER ASKED]: {user_query}")
    
    # Wake up the agent and let it think
    agent = model.start_chat(enable_automatic_function_calling=True)
    response = agent.send_message(user_query)
    
    # Send the final answer back to the website
    return jsonify({"answer": response.text})

# --- 4. START THE BRAIN ---
if __name__ == '__main__':
    print("🧠 QUANT∑ODE Python Brain is online on port 5000...")
    app.run(port=5000)