# Vokabelncoso

Crée une application web responsive en français pour réviser le vocabulaire allemand, utilisable sur ordinateur et téléphone.

Nom provisoire : Vocabulaire Allemand.

Je ne sais pas programmer. Construis l'application progressivement, avec une interface claire et simple, et explique-moi les étapes nécessaires pour connecter la base de données. Utilise Supabase pour l'authentification et la base de données.

L'application doit comporter deux espaces :

1. Espace enseignant

Connexion sécurisée.

Création et gestion de classes.

Création de listes de vocabulaire allemand-français.

Ajout, modification et suppression de mots.

Attribution des listes aux classes.

Consultation des progrès des élèves.

2. Espace élève

Compte individuel et connexion sécurisée.

Accès aux listes attribuées à sa classe.

Historique personnel des révisions et des résultats.

Interface adaptée au téléphone.

Trois modes de révision

Afficher un mot allemand avec sa traduction cachée ; l'élève indique « Je connais » ou « Je ne connais pas ».

Afficher un mot allemand avec quatre traductions françaises proposées, dont une seule correcte.

Afficher une traduction française ; l'élève saisit le mot allemand.

Répétition espacée
Enregistre chaque réponse et chaque révision par élève et par mot. Fais revenir plus souvent les mots ratés et espace progressivement les mots maîtrisés. Les progrès doivent être conservés après déconnexion.

Sécurité indispensable

Distingue les rôles enseignant et élève.

Un élève ne peut consulter que ses propres résultats et les listes de sa classe.

Un élève ne peut ni gérer les classes ni modifier les listes de vocabulaire.

Utilise les règles de sécurité Row Level Security (RLS) de Supabase.

Ne place jamais de clé secrète dans le code visible par les utilisateurs.

Ne crée aucun accès enseignant secret ou mot de passe universel.

Prévois une méthode sûre pour que l'administrateur crée le premier compte enseignant.

Commence par créer l'interface et la structure générale. Avant de prétendre que l'application est terminée, vérifie que la connexion, les permissions, la sauvegarde des résultats et les trois modes fonctionnent réellement avec Supabase.

Je veux rester sur les offres gratuites et ne pas acheter de domaine. N'ajoute aucune fonctionnalité payante.">

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vokabelncoso.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b19bb90c-31f7-5eef-867b-8ebb7542dde2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
