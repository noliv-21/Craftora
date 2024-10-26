// templates.js
const userTemplate = `
  {{#each users}}
    <div class="user-card">
      <p><strong>Username:</strong> {{this.username}}</p>
      <p><strong>Email:</strong> {{this.email}}</p>
      <p><strong>Phone:</strong> {{this.phone}}</p>
    </div>
  {{/each}}
`;

function renderUsers(data) {
    var template = Handlebars.compile(userTemplate);
    var html = template({ users: data });
    document.getElementById('user_details').innerHTML = html;
}

// export default {
//     userTemplate
// };