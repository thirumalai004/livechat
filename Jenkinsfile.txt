pipeline {
    agent any

    triggers { pollSCM('H/2 * * * *') }

    environment {
        APP_ENV    = 'production'
        APP_TITLE  = 'Live Chat'
        JOIN_CODE  = credentials('chat-join-code')
        DH         = credentials('dockerhub-creds')
        IMAGE      = 'thirudocker004/livechat'
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Build') {
            steps {
                sh 'docker build -t $IMAGE:${BUILD_NUMBER} -t $IMAGE:latest .'
            }
        }

        stage('Test') {
            steps {
                sh '''
                  docker rm -f livechat-test || true
                  docker run -d --name livechat-test -e APP_ENV -e APP_TITLE -e JOIN_CODE $IMAGE:${BUILD_NUMBER}
                  sleep 4
                  docker exec livechat-test node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode==200?0:1)).on('error',()=>process.exit(1))"
                '''
            }
            post {
                always { sh 'docker rm -f livechat-test || true' }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh '''
                  echo "$DH_PSW" | docker login -u "$DH_USR" --password-stdin
                  docker push $IMAGE:${BUILD_NUMBER}
                  docker push $IMAGE:latest
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                  docker rm -f livechat || true
                  docker run -d --name livechat --restart unless-stopped -p 3100:3000 \
                    -e APP_ENV -e APP_TITLE -e JOIN_CODE -e BUILD_NUMBER \
                    $IMAGE:${BUILD_NUMBER}
                '''
            }
        }

        stage('Verify') {
            steps {
                sh '''
                  sleep 4
                  docker exec livechat node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode==200?0:1)).on('error',()=>process.exit(1))"
                  echo "Live version is healthy"
                '''
            }
        }
    }

    post {
        success { echo "Deployed build ${BUILD_NUMBER}. Open http://localhost:3100" }
        failure { echo 'Pipeline failed, check the stage that turned red' }
        always  {
            sh 'docker logout || true'
            sh 'docker image prune -f'
        }
    }
}