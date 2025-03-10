from langchain.prompts import PromptTemplate, FewShotPromptTemplate
from langchain_ollama import OllamaLLM

# Instruction to guide the model
instruction = """You are an intelligent assistant that understands user queries and categorizes them appropriately. 
You should return meaningful responses based on the type of place or information requested.
If the user asks about a specific location, return ["Location Name", "Information"].
If the user asks for a category, return only the category name."""

# Define a more structured example prompt template
example_prompt = PromptTemplate.from_template("User Query: {query}\nExpected Response: {answer}")

# Define a more varied set of examples
examples = [
    {"query": "Show me Heritage Sites", "answer": "Heritage Sites"},
    {"query": "What are some famous heritage places?", "answer": "Heritage Sites"},
    {"query": "Give me a list of all temples.", "answer": "Temples and Religious Sites"},
    {"query": "Tell me about the Sabarmati Ashram.", "answer": ["Sabarmati Ashram", "Information"]},
    {"query": "I want details about Kankaria Lake and Zoo", "answer": ["Kankaria Lake and Zoo", "Information"]},
    {"query": "Find me information on Amdavad ni Gufa", "answer": ["Amdavad ni Gufa", "Information"]},
    {"query": "Which museums can I visit?", "answer": "Museums"},
    {"query": "Give me information on Dada Hari ni Vav.", "answer": ["Dada Hari ni Vav", "Information"]},
    {"query": "Tell me about Gujarat Vidhyapeeth.", "answer": ["Gujarat Vidhyapeeth", "Information"]},
    {"query": "List religious places in the city.", "answer": "Temples and Religious Sites"},
        {"query": "Show me Heritage Sites", "answer": "Heritage Sites"},
    {"query": "Show me heritage", "answer": "Heritage Sites"},
    {"query": "Show me Heritage", "answer": "Heritage Sites"},
    {"query": "Show me Heritage Site", "answer": "Heritage Sites"},
    {"query": "Show me Heritage place", "answer": "Heritage Sites"},
    {"query": "Show me Heritage places", "answer": "Heritage Sites"},
    {"query": "Show me Temples and Religious Sites", "answer": " Temples and Religious Sites"},
    {"query": "Show me Temples", "answer": " Temples and Religious Sites"},
    {"query": "Show me temple", "answer": " Temples and Religious Sites"},
    {"query": "Show me Temple", "answer": " Temples and Religious Sites"},
    {"query": "Show me temples", "answer": " Temples and Religious Sites"},
    {"query": "Show me Temples and Religious Site", "answer": "Temples and Religious Sites"},
    {"query": "Show me Museums", "answer": "Museums"},
    {"query": "Show me museum", "answer": "Museums"},
    {"query": "Show me museums", "answer": "Museums"},
    {"query": "Show museum", "answer": "Museums"},
    {"query": "Show Museum", "answer": "Museums"},
    {"query": "Show me Museums", "answer": "Museums"},
    {"query": "Show me Parks and Gardens", "answer": "Parks and Gardens"},
    {"query": "Show me Park", "answer": "Parks and Gardens"},
    {"query": "Show me park", "answer": "Parks and Gardens"},
    {"query": "Show me Park and Garden", "answer": "Parks and Gardens"},
    {"query": "Show me park and garden", "answer": "Parks and Gardens"},
    {"query": "Show me Public Infrastructure", "answer": "Public Infrastructure"},
    {"query": "Show me infrastructure", "answer": "Public Infrastructure"},
    {"query": "Show me infrastructures", "answer": "Public Infrastructure"},
    {"query": "Show me infrastructures site", "answer": "Public Infrastructure"},
    {"query": "Show me infrastructures sites", "answer": "Public Infrastructure"},
    {"query": "Show me food and cuisine", "answer": "Food and Cuisine"},
    {"query": "Show me Food", "answer": "Food and Cuisine"},
    {"query": "Show me food", "answer": "Food and Cuisine"},
    {"query": "Show me Food and Cuisine", "answer": "Food and Cuisine"},
    {"query": "Show me Hotel", "answer": "Hotel"},
    {"query": "Show me hotel", "answer": "Hotel"},
    {"query": "Show me hotels", "answer": "Hotel"},
    {"query": "Show me Hotels", "answer": "Hotel"},
    {"query": "Show me Cultural Events", "answer": "Cultural Events"},
    {"query": "List all Museums", "answer": "Museums"},
    {"query": "Show me information about Amdavad ni Gufa", "answer": ["Amdavad ni Gufa", "Information"]},
    {"query": "Show me information about victoria garden", "answer": ["Victoria Garden", "Information"]},
    {"query": "Show me information about victoria garden", "answer": ["Victoria Garden", "Information"]},
    {"query": "Show me information of victoria garden", "answer": ["Victoria Garden", "Information"]},
    {"query": "Show me information about Kankaria Lake and Zoo", "answer": ["Kankaria Lake and Zoo", "Information"]},
    {"query": "Show me information about kankaria lake and zoo", "answer": ["Kankaria Lake and Zoo", "Information"]},
    {"query": "Show me information about kankaria lake", "answer": ["Kankaria Lake and Zoo", "Information"]},
    {"query": "Show me information about kankaria lake", "answer": ["Kankaria Lake and Zoo", "Information"]},
    {"query": "Show me information about Sundervan", "answer": ["Sundervan", "Information"]},
    {"query": "Show me information about sundervan", "answer": ["Sundervan", "Information"]},
    {"query": "Show me information about amdavad ni gufa.", "answer": ["Amdavad ni Gufa", "Information"]},
    {"query": "Show me information of Amdavad ni Gufa", "answer": ["Amdavad ni Gufa", "Information"]},
    {"query": "Show me information of amdavad ni gufa", "answer": ["Amdavad ni Gufa", "Information"]},
    {"query": "Show me information about Gujarat Vidhyapeeth", "answer": ["Gujarat Vidhyapeeth", "Information"]},
    {"query": "Show me information of gujarat vidhyapeeth.", "answer": ["Gujarat Vidhyapeeth", "Information"]},
    {"query": "Show me information of Gujarat Vidhyapeeth", "answer": ["Gujarat Vidhyapeeth", "Information"]},
    {"query": "Show me information about gujarat vidhyapeeth", "answer": ["Gujarat Vidhyapeeth", "Information"]},
    {"query": "Show me information about Dada Hari ni Vav", "answer": ["Dada Hari ni Vav", "Information"]},
    {"query": "Show me information about dada hari ni vav", "answer": ["Dada Hari ni Vav", "Information"]},
    {"query": "Show me information of dada hari ni vav.", "answer": ["Dada Hari ni Vav", "Information"]},
    {"query": "Show me information of Dada Hari ni Vav", "answer": ["Dada Hari ni Vav", "Information"]},
    {"query": "Show me information of Sabarmati Ashram", "answer": ["Sabarmati Ashram", "Information"]},
]

# Create the FewShotPromptTemplate
prompt = FewShotPromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
    suffix="User Query: {input}\nExpected Response:",
    input_variables=["input"],
    prefix=instruction  # Adds general instructions
)

# Instantiate the Ollama model
model = OllamaLLM(model="mistral:7b", num_predict=50)

# Create the chain (prompt and model)
chain = prompt | model

# Interactive testing loop
print("Type 'exit' to quit.")
while True:
    user_input = input("You: ")
    if user_input.lower() == "exit":
        break
    result = chain.invoke({"input": user_input})
    print(f"Model: {result}")