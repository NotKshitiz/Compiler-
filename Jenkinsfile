pipeline{
    agent any

    stages{
        stage('Clone'){
            steps{
               git branch: 'main', url: 'https://github.com/NotKshitiz/Compiler-.git'
            }
        }

        stage('Install Dependencies'){
            steps{
                sh 'npm install'
            }
        }

        stage('Build Docker Image'){
            steps{
                sh 'docker build -t blockchain-compiler .'
            }
        }

        stage('Run Compiler'){
            steps{
                sh 'docker run -d -p 3000:3000 --name compiler-run blockchain-compiler'
            }
        }
    }
}
