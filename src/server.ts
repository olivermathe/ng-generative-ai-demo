import express, { query, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

dotenv.config();

const server = express();
const port = 3000;

const googleAiStudioApiKey = process.env['GOOGLE_AI_STUDIO_API_KEY'];

if (!googleAiStudioApiKey) {
  throw new Error('Provide GOOGLE_AI_STUDIO_API_KEY in a .env file');
}

const genAI = new GoogleGenerativeAI(googleAiStudioApiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  systemInstruction: 
  // `
  // Você é um assistente de uma locadora de filmes que ajuda o funcionário a realizar tarefas no sistema.
  // O usuário não tem conhecimento de formatos JSON ou XML.
  // Retorne as informações sempre em linguagem natural.
  // Sua resposta esta sendo exibida dentro de um innerHtml.
  // Você pode utilizar tags HTML na resposta.
  // Caso o usuário pessa exibição de gráficos, você pode utilizar GraphJs na resposta, eu incluí a dependência da biblioteca no projeto.
  // Use sempre um ID diferente para cada gráfico que exibir.
  // `
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
      functionDeclarations: [
        {
          name: 'getUsers',
          description: 'Retorna os usuários cadastrados no sistema da locadora, pode ser usado com filtro ou sem o filtro para listar todos',
          parameters: {
            type: SchemaType.OBJECT,
            description: 'Campos para filtrar a busca de usuário, os campos podem ser ignorados para listar todos usuários cadastrados',
            properties: {
              nome: {
                type: SchemaType.STRING,
                description: 'Nome do usuário para buscar no sistema',
                nullable: true
              },
              email: {
                type: SchemaType.STRING,
                description: 'E-mail do usuário para buscar no sistema',
                nullable: true
              },
              id: {
                type: SchemaType.NUMBER,
                description: 'Identificador único do cliente cadastrado no sistema',
                nullable: true
              }
            },
            required: []
          }
        },
        {
          name: 'getMovies',
          description: 'Retorna os filmes cadastrados no sistema da locadora, pode ser usado com filtro ou sem o filtro para listar todos',
          parameters: {
            type: SchemaType.OBJECT,
            description: 'Campos para filtrar a busca de filmes, os campos podem ser ignorados para listar todos filmes cadastrados',
            properties: {
              titulo: {
                type: SchemaType.STRING,
                description: 'Título do filme para buscar no sistema',
                nullable: true
              },
              ano: {
                type: SchemaType.NUMBER,
                description: 'Ano de lançamento do filme para buscar no sistema',
                nullable: true
              },
              precoDiario: {
                type: SchemaType.NUMBER,
                description: 'Preço diário atual do filme para ser alugado',
                nullable: true
              },
              id: {
                type: SchemaType.NUMBER,
                description: 'Identificador único do filme cadastrado no sistema',
                nullable: true
              }
            },
            required: []
          }
        },
        {
          name: 'getRents',
          description: 'Retorna os alugueis realizado pelos usuários cadastrados no sistema da locadora, pode ser usado com filtro ou sem o filtro para listar todos',
          parameters: {
            type: SchemaType.OBJECT,
            description: 'Campos para filtrar a busca de alugueis, os campos podem ser ignorados para listar todos alugueis cadastrados',
            properties: {
              clienteId: {
                type: SchemaType.NUMBER,
                description: 'Identificador único do usuário que realizao o aluguel de filme',
                nullable: true
              },
              filmeId: {
                type: SchemaType.NUMBER,
                description: 'Identificador único do filme que foi alugado',
                nullable: true
              },
              dataAluguel: {
                type: SchemaType.STRING,
                description: 'Data em que foi realizado o aluguel',
                nullable: true
              },
              dataDevolucaoPrevista: {
                type: SchemaType.STRING,
                description: 'Data prevista para o cliente devolver o filme',
                nullable: true
              },
              id: {
                type: SchemaType.NUMBER,
                description: 'Identificador único do filme cadastrado no sistema',
                nullable: true
              }
            },
            required: []
          }
        }
      ]
    }
  ]
});

const chat = model.startChat();

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
    
    let result = await chat.sendMessage(prompt);

    console.log("INICIO-MESSAGE", result.response.functionCalls());


    while(result.response.functionCalls()) {

      console.log("INICIO-FUNCTION-CALLs")

      const functionCall = result.response.functionCalls()!;

      let functionResponseList = [];

      for (const call of functionCall) {

        const { name, args } = call;

        let func = functionsImplementations[name]

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

      result = await chat.sendMessage(functionResponseList)

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

let functionsImplementations: any = {
  'getUsers': getUsers,
  'getMovies': getMovies,
  'getRents': getRents
}

async function getMovies(res: Response, params: { titulo?: string, ano?: number, precoDiario?: string, id?: number }): Promise<any> {
  return await get(res, params, '/filmes');
}

async function getUsers(res: Response, params: { id?: number, name?: string, email?: number }): Promise<any> {
  return await get(res, params, '/clientes');
}

async function getRents(res: Response, params: { id?: number, clienteId?: number, filmeId?: number, dataAluguel?: string, dataDevolucaoPrevista?: string }): Promise<any> {
  return await get(res, params, '/alugueis');
}

async function get(res: Response, params: any, path: string) {
  return await callAPI(res, 'GET', `${path}?${buildQueryString(params)}`);
}

async function callAPI(res: Response, method: 'GET' | 'POST' | 'DELETE' | 'PUT', path: string, body?: any): Promise<globalThis.Response> {

  const headers = {
    "Content-Type": "application/json"
  };

  let response;

  console.log('Calling API:');
  // res.write('Calling API:<br>');

  let url = `http://localhost:8181${path}`;

  console.log(`${method} ${url}`, body);
  // res.write(`${method} ${url}<br>`);

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