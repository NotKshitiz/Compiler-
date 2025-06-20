pipeline{
    agent any

    stages{
        stage('Clone'){
            steps{
                git 'https://github.com/NotKshitiz/Compiler-.git'
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
                sh 'docker run blockchain-compiler'
            }
        }
    }
}