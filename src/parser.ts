import SwaggerParser from "@apidevtools/swagger-parser";
import { FunctionDeclaration, FunctionDeclarationSchema, FunctionDeclarationSchemaProperty, SchemaType } from "@google/generative-ai";
const swaggerFile = './src/swagger-bff-3.yaml';

let toolsDefinition: { [k: string]: ToolDefinition } = {};

interface ToolDefinition {
    declaration: FunctionDeclaration;
    implementation: Function;
    params: { [k: string]: string };
}

interface ApiParam {
    name: string;
    schema: { type: 'string' | 'integer' | 'number' |'boolean' };
    required: boolean;
    in: 'path' | 'query' | 'body';
    description: string
}

const methods = ['get', 'delete', 'post', 'put'];

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

async function run() {
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
                    params
                }

            }
            
        }

        console.log(JSON.stringify(toolsDefinition));

    } catch (e) {
        console.error(e);
    }
}

run();