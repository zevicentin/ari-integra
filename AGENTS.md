<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep ARI records in Lovable Cloud with owner-scoped row policies and a separate roles table, so accounts cannot elevate privileges or see another agent's private records.
- Use one authenticated workspace at the home route with section navigation, so field agents and coordinators share the same responsive application.
- Store activity evidence in a private user-folder bucket, so uploaded images are not publicly exposed.
- Keep strategy-plan actions in their own table with a catalog-constrained axis, where one axis may hold several actions, and keep each action's expected results in a flat JSON list of descriptions beside a second flat list of activities that also carry a status and a period, so the plan is navigable on its own page, and old plan activities keep their nested outcomes.
- Match the app's stored status wording when reading a status out of a document, comparing accent-insensitively and only accepting a value that stands alone on its line, so an activity called "Realizar visitas técnicas" is never read as a concluded status.
- Read the strategy plan from a Markdown file that follows the labels in `public/modelos/plano-estrategias.md`, and the activities report from the model in `public/modelos/atividades.md` (PDF reports still parse), keeping description, objectives, expected results and achieved results each in its own field, falling back from the conclusion day to the start day when the record heading carries no period, and giving every imported row the status "Concluída" for the reviewer to adjust, so each reader matches the format its document actually arrives in and nothing is guessed from page layout.
- Write the plan's activities from the plan page itself, each one with a description, a status and a period, and let every activity hold any number of subtasks of that same shape, so the plan is the one place the plan is written and an activity's share of the execution percentage comes from its subtasks when it has any, or from its own status counted as a single task when it has none.
- Resolve coordination-meeting participant choices through an authenticated database function that excludes privileged and viewer roles, so users do not need direct access to other accounts' role rows.
- Create email accounts through a validated server function that assigns roles separately; coordinators have database-enforced read-only access to all records.
- Keep requested account roles separate from granted roles and grant access only after an administrator approves the account.
