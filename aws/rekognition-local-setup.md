# Tester la modération Rekognition en local

En production sur Amplify, la route utilise les identifiants temporaires du rôle **SSR Compute**. Ne définis pas de clé AWS dans `.env.production` ni dans une variable `NEXT_PUBLIC_*`.

En local, installe/configure AWS CLI sur ta machine, puis connecte-toi avec un profil AWS qui a uniquement les permissions listées dans `rekognition-photo-moderation-policy.json`.

Exemple avec AWS CLI et un profil nommé `aras-dev` :

```powershell
aws configure --profile aras-dev
$env:AWS_PROFILE = 'aras-dev'
npm run dev
```

Ou définis `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` et éventuellement `AWS_SESSION_TOKEN` dans la session PowerShell uniquement. Ne les écris pas dans le dépôt et ne partage pas ces valeurs.

Si tu n’as pas encore un utilisateur/role IAM local configuré, le contrôle photo renverra `503` en local. C’est volontaire : la route n’enregistre pas une photo sans l’avoir modérée.
