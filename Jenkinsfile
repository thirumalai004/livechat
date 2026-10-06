pipeline {
    agent any

    triggers { pollSCM('H/2 * * * *') }

    environment {
        APP_ENV   = 'production'
        APP_TITLE = 'Team Chat v3'
        HOST_PORT = '3200'
        IMAGE     = 'thirudocker004/livechat'
        JOIN_CODE = credentials('chat-join-code')
        DH        = credentials('dockerhub-creds')
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
                  echo "Test passed"
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
                  docker logout
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                  docker rm -f livechat || true

                  if docker ps --format '{{.Names}} {{.Ports}}' | grep -q ":${HOST_PORT}->"; then
                    echo "ERROR: port ${HOST_PORT} is already used by another container:"
                    docker ps --format '{{.Names}} {{.Ports}}' | grep ":${HOST_PORT}->"
                    echo "Stop it or change HOST_PORT in the Jenkinsfile."
                    exit 1
                  fi

                  docker run -d --name livechat --restart unless-stopped \
                    -p ${HOST_PORT}:3000 \
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
        success { echo "Deployed build ${BUILD_NUMBER}. Open http://localhost:${HOST_PORT}" }
        failure { echo 'Pipeline failed, check the stage that turned red' }
        always  { sh 'docker image prune -f || true' }
    }
}