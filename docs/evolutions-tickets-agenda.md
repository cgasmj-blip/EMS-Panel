# Évolutions demandées — tickets et agenda personnel

> Cahier des charges. Ce document ne signifie pas que les fonctionnalités sont implémentées.

## Tickets
- Un ticket au statut fermé doit apparaître en rouge (libellé et repère visuel).
- Les nouveaux tickets doivent rester en tête de liste ; les tickets fermés ne doivent pas remonter devant eux.
- L'ordre doit se mettre à jour lors de chaque changement de statut ou arrivée d'un ticket.

## Agenda personnel (référence : agenda EMS du panel)
- Chaque utilisateur authentifié peut choisir une date et une heure, créer, déplacer, modifier et supprimer ses propres rendez-vous.
- L'agenda doit reprendre l'ergonomie de l'agenda EMS déjà présent sur le panel.
- Les rendez-vous sont privés : l'accès doit être limité au propriétaire **dans la base de données via RLS**, et pas seulement dans l'interface.
- À la création, modification ou annulation, le bot envoie une confirmation en message privé à l'utilisateur concerné.
- Rappels privés par bot configurables (24 h, 1 h, 15 min avant) ; annuler/reprogrammer les rappels en cas de changement.
- Pas de notifications push navigateur/téléphone : « push » désignait l'envoi du projet sur GitHub.

## Points techniques à vérifier avant livraison
- L'agenda existant se trouve dans `src/pages/app/AgendaTab.tsx` et interroge `appointments` avec `staff_id`.
- Vérifier les politiques RLS, le service bot, les tâches planifiées et les migrations avant de promettre confidentialité et rappels.
- Tester les droits entre deux comptes distincts, le tri des tickets et les confirmations/rappels.
