# FiveM PvP Trainer

Aplicativo desktop para treino e aprimoramento de habilidades PvP no FiveM (GTA V).

## Visão Geral

O FiveM PvP Trainer é uma ferramenta de apoio para jogadores que desejam melhorar sua performance em combate dentro de servidores FiveM. O app oferece análise de desempenho, dicas táticas e exercícios de treinamento customizáveis.

## Tecnologias

- **Frontend:** React
- **Backend:** Python / Flask
- **Plataforma:** Desktop (Electron ou similar)

## Estrutura do Projeto

```
fivem-pvp-trainer/
├── src/
│   ├── frontend/        # Interface React
│   └── backend/         # API Flask (Python)
├── assets/              # Imagens, ícones e recursos estáticos
├── docs/                # Documentação
├── requirements.txt     # Dependências Python
├── README.md
└── .gitignore
```

## Como Executar

### Backend (Python/Flask)

```bash
# Criar e ativar ambiente virtual
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/Mac

# Instalar dependências
pip install -r requirements.txt

# Iniciar servidor
python src/backend/app.py
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
