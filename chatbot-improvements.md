# Plans to reduce cost of using AI chatbot

## Problems:
- The current cost of using the chatbot is way too high. Sometimes individual questions can cost as much as $.25. 

## Likely causes:
- Unnecessary context provided in most situations. Right now a major problem is that too many input token are being passed in situations where they aren't necessary
- For instance, when a user highlights text such as a function in the SourceCodePanel.tsx, the model searches through all files until it finds the associated function. This is extremely inefficient and even leads to unclear outcomes such as the model responding: "I think the user wants to know about *function name* in *likely file*", instead of the model knowing exactly which file is being referenced

## Strategies
1. Reduce the amount of context the model is required to search for by providing more upfront context for the model to use. For instance, the name of the current node or file being highlighted should always be passed as context. If the user is highlighting functions from the source code panel, then logically the model need only search for functions from that file. 
2. We should provide users an option to include the codebase analysis as context, but only when they want to ask questions directly related to the codebase. This will provide the user the ability to direct their questions and reduce unecessary context for general questions not directly related to the codebase, such as "What is typescript" or "What is FastAPI". 
3. Reduce tool calling in situations where it isn't necessary. Users will likely ask general questions about certain tech stacks or other functionality that doesn't require the full codebase analysis to answer. In fact most questions will be general and not directly related to the codebase in question. 
4. Take a closer look at the current system prompts and look for improvements. 