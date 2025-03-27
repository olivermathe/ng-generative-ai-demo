const fs = require('fs');

function generateRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

function generateFilmes() {
  const filmes = [];
  const titulos = ["Filme", "Aventura", "Mistério", "Comédia", "Drama"];
  const generos = ["Ação", "Drama", "Comédia", "Animação", "Ficção Científica", "Romance", "Terror"];
  for (let i = 1; i <= 100; i++) {
    filmes.push({
      id: i,
      titulo: `${titulos[Math.floor(Math.random() * titulos.length)]} ${i}`,
      genero: generos[Math.floor(Math.random() * generos.length)],
      ano: Math.floor(Math.random() * (2025 - 1970 + 1)) + 1970,
      disponivel: Math.random() > 0.3,
      precoDiario: parseFloat((Math.random() * (7 - 4) + 4).toFixed(2))
    });
  }
  return filmes;
}

function generateClientes() {
  const clientes = [];
  const nomes = ["João", "Maria", "Pedro", "Ana", "Lucas", "Clara", "Rafael", "Beatriz", "Gabriel", "Juliana"];
  const sobrenomes = ["Silva", "Santos", "Almeida", "Costa", "Oliveira", "Mendes", "Lima", "Souza", "Rocha", "Pereira"];
  for (let i = 1; i <= 100; i++) {
    const nome = `${nomes[Math.floor(Math.random() * nomes.length)]} ${sobrenomes[Math.floor(Math.random() * sobrenomes.length)]}`;
    clientes.push({
      id: i,
      nome,
      email: `${nome.toLowerCase().replace(" ", ".")}@email.com`,
      telefone: `(${Math.floor(Math.random() * 90 + 10)}) 9${Math.floor(Math.random() * 90000 + 10000)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      dataCadastro: generateRandomDate(new Date(2024, 0, 1), new Date(2025, 2, 26))
    });
  }
  return clientes;
}

function generateAlugueis(clientes, filmes) {
  const alugueis = [];
  for (let i = 1; i <= 100; i++) {
    const dataAluguel = generateRandomDate(new Date(2025, 0, 1), new Date(2025, 2, 26));
    const dias = Math.floor(Math.random() * 7) + 1;
    const dataDevolucaoPrevista = new Date(dataAluguel);
    dataDevolucaoPrevista.setDate(dataDevolucaoPrevista.getDate() + dias);
    const filme = filmes[Math.floor(Math.random() * filmes.length)];
    const valorTotal = parseFloat((filme.precoDiario * dias).toFixed(2));
    const concluido = Math.random() > 0.7;
    alugueis.push({
      id: i,
      clienteId: Math.floor(Math.random() * clientes.length) + 1,
      filmeId: filme.id,
      dataAluguel,
      dataDevolucaoPrevista: dataDevolucaoPrevista.toISOString().split('T')[0],
      dataDevolucaoReal: concluido ? generateRandomDate(new Date(dataAluguel), dataDevolucaoPrevista) : null,
      valorTotal,
      status: concluido ? "concluido" : "ativo"
    });
  }
  return alugueis;
}

const filmes = generateFilmes();
const clientes = generateClientes();
const alugueis = generateAlugueis(clientes, filmes);

const db = { filmes, clientes, alugueis };
fs.writeFileSync('db.json', JSON.stringify(db, null, 2));

console.log('Arquivo db.json gerado com 100 registros para cada categoria!');