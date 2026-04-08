# Zync — AI-Powered Debate Moderation Platform

A real-time debate platform with AI-powered moderation, featuring toxicity detection, logical fallacy identification, and RAG-based fact-checking.

![Zync Platform](https://via.placeholder.com/1200x630/0A0A0A/6366F1?text=Zync+Debate+Moderator)

## ✨ Features

### Core Features
- **Real-time Debates**: Socket.io powered live chat with instant message delivery
- **AI Moderation**: Automatic detection of toxic content with severity levels
- **Fallacy Detection**: Identifies logical fallacies like Ad Hominem, Straw Man, etc.
- **Fact Checking**: RAG-based claim verification system
- **Room Management**: Create public/private debate rooms with customizable rules

### User Features
- **Authentication**: JWT-based auth with refresh tokens
- **User Profiles**: Customizable profiles with debate statistics
- **Achievements**: Gamified experience with badges and reputation
- **Real-time Notifications**: Stay updated on room activities

### Admin Features
- **Dashboard**: Platform analytics and monitoring
- **User Management**: Ban/unban users, manage roles
- **Moderation Queue**: Review and act on flagged content
- **AI Settings**: Configure moderation thresholds

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express** - Server framework
- **MongoDB** + **Mongoose** - Database
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing

### Frontend
- **React 18** - UI framework
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Zustand** - State management
- **React Query** - Server state management
- **Socket.io Client** - Real-time communication
- **Lucide React** - Icons

### AI Server
- **Python 3.9+** - Runtime
- **FastAPI** - API framework
- **Pydantic** - Data validation
- (Optional) Transformers, LangChain for ML models

## 📦 Installation

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB 6+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/zync.git
cd zync
```

### 2. Backend Setup
```bash
cd server
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm run dev
```

### 3. Frontend Setup
```bash
cd client
npm install

# Copy environment file
cp .env.example .env

# Start the development server
npm start
```

### 4. AI Server Setup
```bash
cd ai-server

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python main.py
```

## 🔧 Configuration

### Server (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/zync_debate
JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret
AI_SERVER_URL=http://localhost:8000
CLIENT_URL=http://localhost:3000
```

### Client (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_AI_ENABLED=true
```

## 🚀 Running the Application

Start all services:

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm start

# Terminal 3 - AI Server
cd ai-server && python main.py
```

Access the application at `http://localhost:3000`

## 📁 Project Structure

```
zync/
├── server/                 # Node.js backend
│   ├── index.js           # Entry point
│   ├── middleware/        # Express middleware
│   ├── models/            # Mongoose models
│   ├── routes/            # API routes
│   └── socket/            # Socket.io handlers
│
├── client/                # React frontend
│   ├── public/            # Static files
│   └── src/
│       ├── components/    # UI components
│       ├── layouts/       # Layout components
│       ├── pages/         # Page components
│       ├── services/      # API services
│       └── store/         # Zustand stores
│
├── ai-server/             # Python AI server
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
│
└── README.md
```

## 🎨 UI Components

The project includes a comprehensive component library:

- **Button** - Multiple variants and sizes
- **Card** - Container with glow effects
- **Input/Textarea** - Form inputs
- **Avatar** - User avatars with status
- **Badge** - Status indicators
- **Modal** - Dialog boxes
- **Toast** - Notifications
- **Skeleton** - Loading states

## 🤖 AI Features

### Toxicity Detection
Analyzes messages for:
- Insults and personal attacks
- Threats and intimidation
- Hate speech
- Profanity

### Fallacy Detection
Identifies common logical fallacies:
- Ad Hominem
- Straw Man
- False Dichotomy
- Appeal to Authority
- Slippery Slope
- Hasty Generalization
- Circular Reasoning
- Red Herring

### Fact Checking
- Extracts factual claims from messages
- Validates against knowledge base
- Provides credibility scores

## 📝 API Documentation

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| POST | /api/auth/refresh | Refresh access token |
| POST | /api/auth/logout | Logout user |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/rooms | List all rooms |
| POST | /api/rooms | Create new room |
| GET | /api/rooms/:id | Get room details |
| PUT | /api/rooms/:id | Update room |
| DELETE | /api/rooms/:id | Delete room |

### AI Server
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/analyze | Analyze message content |
| POST | /api/fact-check | Check a specific claim |
| GET | /api/fallacies | List detectable fallacies |
| GET | /api/health | Health check |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
- [FastAPI](https://fastapi.tiangolo.com/)
