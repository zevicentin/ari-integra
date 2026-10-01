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
- Keep strategy-plan linked activities nested in each outcome's JSON data and normalize legacy text on edit, so existing plans remain editable without a separate table.
- Resolve coordination-meeting participant choices through an authenticated database function that excludes privileged and viewer roles, so users do not need direct access to other accounts' role rows.
- Create email accounts through a validated server function that assigns roles separately; coordinators have database-enforced read-only access to all records.
