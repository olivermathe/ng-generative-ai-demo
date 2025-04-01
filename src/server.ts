import express, { query, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatSession, FunctionDeclaration, FunctionDeclarationSchemaProperty, GenerativeModel, GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import SwaggerParser from "@apidevtools/swagger-parser";

dotenv.config();

const server = express();
const port = 3000;

const apiHost = '';
const apiToken = '';

const swaggerFile = './src/swagger-bff-3.yaml';

let toolsDefinition: { [k: string]: ToolDefinition } = {};

interface ToolDefinition {
    declaration: FunctionDeclaration;
    implementation: Function;
    params: { [k: string]: string };
    path: string;
    method: string;
}

interface ApiParam {
    name: string;
    schema: { type: 'string' | 'integer' | 'number' |'boolean' };
    required: boolean;
    in: 'path' | 'query' | 'body';
    description: string
}

const methods = ['get', 'delete', 'post', 'put'];

const googleAiStudioApiKey = process.env['GOOGLE_AI_STUDIO_API_KEY'];

if (!googleAiStudioApiKey) {
  throw new Error('Provide GOOGLE_AI_STUDIO_API_KEY in a .env file');
}

const genAI = new GoogleGenerativeAI(googleAiStudioApiKey);
let model: GenerativeModel | undefined;

let chat: ChatSession | undefined;

let graphCount = 1;

server.use(express.text());
server.use(cors());

server.listen(port, () => {
  console.log('Server is running on port', port);
});

interface IJson {
  method: "POST" | "GET" | "DELETE";
  url: string,
  body?: any
  query?: any
}

server.post('/message', async (req: Request, res: Response) => {
  let prompt: string = req.body;

  if (!prompt) {
    return res.status(400).end();
  }

  console.log("INICIO-MESSAGE");

  try {
    
    let result = await chat!.sendMessage(prompt);

    console.log("INICIO-MESSAGE", result.response.functionCalls());


    while(result.response.functionCalls()) {

      console.log("INICIO-FUNCTION-CALLs")

      const functionCall = result.response.functionCalls()!;

      let functionResponseList = [];

      for (const call of functionCall) {

        const { name, args } = call;

        let func = toolsDefinition[name].implementation;

        console.log("FUNCTION-CALL: " + name)

        if (func) {
          const body = await func(res, args);
          console.log(body);
          functionResponseList.push({
            functionResponse: {
              name: name,
              response: { body }
            }
          });
        } else {
          throw new Error('Função "'+name+'" não encontrada')
        }

      }

      result = await chat!.sendMessage(functionResponseList)

    }

    console.log("FIM-MESSAGE");

    let text = result.response.text().replaceAll('```html', '').replaceAll('```', '');

    if (text.includes("graph_app")) {
      text = text.replaceAll('graph_app', 'graph' + graphCount);
      text = text.replaceAll('canvas_app', 'canvas' + graphCount);
      graphCount++;
    }

    console.log(text);

    res.write(text);

  } catch (err) {
    console.error(err);
    res.status(500);
  }

  return res.end();
});

async function callAPI(params: any, definition: ToolDefinition): Promise<globalThis.Response> {

  let queryFields: any = {};
  let body: any;
  let path = definition.path;

  const method = definition.method;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + apiToken
  };

  let response;

  console.log('Calling API:');

  for (const field in params) {
    
    if (definition.params[field] === 'query') {
      queryFields[field] = params[field];
    } else if(definition.params[field] === 'body') {
      body = body || {};
      body[field] = params[field];
    } else if(definition.params[field] === 'path') {
      path.replace(`{${field}}`, params[field]);
    }

  }

  let url = `${apiHost}${path}?${buildQueryString(queryFields)}`;

  console.log(`${method} ${url}`, body);

  response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });

  if (!response || !response.ok) {
    throw new Error('Erro ao chamar endpoint.')
  }
  
  return await response.json();

}

function buildQueryString(params: any) {
  let queryString = '';
  if (params) {
    for (const field in params) {
      let value = params[field];
      queryString += `${field}=${value}&`;
    }
  }
  return queryString;
}

function getType(type: string): SchemaType {

    switch (type) {
        case 'string':
            return SchemaType.STRING;

        case 'number':
        case 'integer':
            return SchemaType.NUMBER;
          
        case 'boolean':
            return SchemaType.BOOLEAN;

        case 'array':
            return SchemaType.ARRAY;
    
        default:
            throw new Error("Tipo de parâmetro '"+type+"' não é válido");
    }

}

async function swaggerToTools() {
  try {
    const api = await SwaggerParser.validate(swaggerFile);

    for (const pathName in api.paths) {

        const path = api.paths[pathName]!;

        for (const methodName of methods) {
            const method = path[methodName as 'get' | 'post' | 'delete' | 'put'];

            if (!method) {
                continue
            }

            let parameters = method?.parameters || [];

            if (!parameters.length) {
                const m = method as any;
                try {
                    let params = m['requestBody']['content']['application/json']['schema']['properties'];
                    for (let field in params) {
                        let param = params[field];
                        parameters.push({
                            description: param['description'],
                            name: field,
                            in: 'body',
                            required: false,
                            schema: { 
                                type: param['type']
                            },
                        } as ApiParam)
                    }
                } catch (e) {
                    console.log(`Parâmetros não encontrados para ${methodName} ${pathName}`);
                }
            }

            let declaration: FunctionDeclaration = {
                name: method?.operationId!,
                description: method?.description || method?.summary,
                parameters: parameters ? {
                    type: SchemaType.OBJECT,
                    description: 'Campos disponíveis para utilizar nesta função',
                    properties: {} 
                } : undefined
            };

            let params: { [k: string]: string } = {};

            parameters?.forEach((param: any) => {

                try {
                
                    const p = param as ApiParam;

                    declaration.parameters!.properties[p.name] = {
                        type: getType(p.schema.type),
                        nullable: p.required,
                        description: p.description,
                    } as FunctionDeclarationSchemaProperty;

                    params[p.name] = p.in;

                } catch (e) {
                    console.error(e);
                }

            });

            toolsDefinition[method!.operationId!] = {
                declaration,
                implementation: (params: any) => console.log(params),
                params,
                path: pathName,
                method: methodName.toUpperCase()
            }

            toolsDefinition[method!.operationId!].implementation = (params: any) => callAPI(params, toolsDefinition[method!.operationId!]);


        }
        
    }

  } catch (e) {
      console.error(e);
  }
}

async function run() {

  await swaggerToTools();

  let functions: FunctionDeclaration[] = [];

  for (const field in toolsDefinition) {
    functions.push(toolsDefinition[field].declaration);
  }

  model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: 
    `
    Você é um assistente virtual de uma locadora de filmes, projetado para ajudar o funcionário a realizar tarefas no sistema da locadora.
    O usuário não tem conhecimento técnico sobre formatos como JSON ou XML, então responda sempre em linguagem natural, clara e simples.
    Suas respostas serão exibidas em um elemento innerHTML de uma página web, permitindo o uso de tags HTML para formatar o texto e melhorar a apresentação.
    Quando o usuário solicitar a exibição de gráficos, como um gráfico de barras ou outro tipo, gere o gráfico diretamente na resposta usando a biblioteca GraphJS, que já está incluída no projeto.
    Para cada gráfico, use sempre ID "graph_app" e "canvas_app" para o canvas no código HTML para garantir que funcione corretamente, mas não mencione detalhes técnicos como "GraphJS" ou "ID" na resposta, a menos que o usuário pergunte.
    Se precisar de mais informações para gerar o gráfico, peça ao usuário de forma clara e amigável, como: "Quais filmes você gostaria de incluir? Todos ou de um ator específico?".
    `
    ,
    tools: [
      {
        functionDeclarations: functions
      }
    ]
  });

  chat = model.startChat();
    
}

run();