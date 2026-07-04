# FiveM PvP Trainer

Aplicativo desktop para treino e aprimoramento de habilidades PvP no FiveM (GTA V).

## Visão Geral

O FiveM PvP Trainer é uma ferramenta de apoio para jogadores que desejam melhorar sua performance em combate dentro de servidores FiveM. O app oferece análise de desempenho, dicas táticas e exercícios de treinamento customizáveis.

## Tecnologias

- **Frontend:** React
- **Backend:** Python / Flask (serverless, via Vercel), Supabase
- **Plataforma:** Desktop (Electron, carrega o app web hospedado na Vercel)

## Estrutura do Projeto

```
fivem-pvp-trainer/
├── api/                 # Backend Flask serverless (Vercel + Supabase)
├── src/
│   └── frontend/        # Interface React
├── electron/            # Wrapper desktop (Electron)
├── assets/              # Imagens, ícones e recursos estáticos
├── docs/                # Documentação
├── requirements.txt     # Dependências Python (api/)
├── README.md
└── .gitignore
```

## Como Executar

### Backend (Python/Flask, api/)

```bash
# Criar e ativar ambiente virtual
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/Mac

# Instalar dependências
pip install -r requirements.txt

# Iniciar servidor (requer variáveis de ambiente do Supabase)
python api/index.py
```

### Frontend (React)

```bash
cd src/frontend
npm install
npm run dev
```

## Contribuição

Pull requests são bem-vindos. Para mudanças maiores, abra uma issue primeiro para discutir o que você gostaria de mudar.

## Licença

[MIT](LICENSE)
