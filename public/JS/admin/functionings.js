console.log('functionings.js working');
// Register loops helper on client-side
Handlebars.registerHelper('userDisp', function (value, options) {
    if (!Array.isArray(value)) {
        return 'No users to display'; // or return an empty string
    }

    let out = "";
    for (let i = 0; i < value.length; i++) {
        out += options.fn(value[i]);
    }
    return out;
});

async function search_users() {
    const query = document.getElementById('search').value;

    try {
        const response = await fetch(`/admin/search-users?query=${query}`);
        const data = await response.json();
        console.log(data);
        
        // Check if data is returned
        if (data.length === 0) {
            document.getElementById('user_details').innerHTML = '<tr><td colspan="3">No users found.</td></tr>';
            return;
        }
        // Compile Handlebars template
        const templateSource = document.getElementById('user-template').innerHTML;
        const template = Handlebars.compile(templateSource);
        // Render the data into HTML using the template
        const userDetailsHTML = template({ users: data });
        // Inject the rendered HTML into the DOM
        document.getElementById('user_details').innerHTML = userDetailsHTML;

        // // Ensure data is an array before proceeding
        // if (Array.isArray(data)) {
        //     // const userDetailsContainer = document.getElementById('user_details');
        //     // // Fetch the template from the script tag (or use it directly)
        //     // const templateSource = document.getElementById('user-template').innerHTML;
        //     // const template = Handlebars.compile(templateSource);
        //     // // Replace the content of #user_details with the compiled template
        //     // userDetailsContainer.innerHTML = template({ users: data });

        //     // // Replace the content of #user_details with the result from the loops helper
        //     // const userDetailsContainer = document.getElementById('user_details');
        //     // const template = Handlebars.compile("{{userDisp users}}");
        //     // userDetailsContainer.innerHTML = template({ users: data });

        //     // // Compile Handlebars template
        //     // const templateSource = document.getElementById('user-template').innerHTML;
        //     // const template = Handlebars.compile(templateSource);
        //     // // Render the HTML with the received data
        //     // const userDetailsHTML = template({ users: data });
        //     // // Inject the rendered HTML into the table body
        //     // document.getElementById('user_details').innerHTML = userDetailsHTML;

        //     // const userDetailsContainer = $('#user_details');
        //     // const template = Handlebars.compile($('#user-template').html());
        //     // userDetailsContainer.html(template({ users: data }));
        // } else {
        //     console.error("The data fetched is not an array:", data);
        // }
    } catch (error) {
        console.error('Error fetching users:', error);
    }

    // $.ajax({
    //   url: `/admin/search-users?query=${query}`,
    //   method: 'GET',
    //   success: function (data) {
    //     const userDetailsContainer = $('#user_details');
    //     const template = Handlebars.compile($('#user-template').html());
    //     userDetailsContainer.html(template({ users: data.users }));
    //   },
    //   error: function (err) {
    //     console.error('Error fetching users:', err);
    //   }
    // });
}
