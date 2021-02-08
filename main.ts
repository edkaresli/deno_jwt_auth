import { opine, json, urlencoded } from 'https://deno.land/x/opine/mod.ts'; 
import { create, verify, getNumericDate } from "https://deno.land/x/djwt/mod.ts";
import { User, Article } from './types.ts';

const db = JSON.parse(Deno.readTextFileSync('./db.json'));
const articles = JSON.parse(Deno.readTextFileSync('./articles.json'));

const app = opine();

app.use(json());
app.use(urlencoded());

app.get('/', (req, res) => {
    res.setStatus(200);
    res.send(`<h2>Hello and login to continue</h2>`);
})

app.get('/register', (req, res) => {
    res.send(`<div>
    <h2>Please register</h2> 
    <form method="post" action="/register">
        <label for="username">Enter your username:</label>
        <input type="text" id="username" name="username"><br><br>
        <label for="password">Enter your password:</label>
        <input type="password" id="password" name="password"><br><br>                    
        <input type="submit" value="Register">
    </form>
  </div>`);
})

app.post('/register', (req, res) => {
    console.log("Received a post /register request");
    const newUser: User = { username: req.body.username, password: req.body.password, jwt: "" }
    db.users.push(newUser);
    console.log(newUser);
    res.redirect(301, '/login'); 
})

app.get('/login', (req, res) => {
    console.log("Received a GET /login request");
    res.send(`
             <div>
               <h1>Welcome to this JWT tutorial</h1>
               <h2>Please login</h2>
               <form method="post" action="/login">
                 <label for="username">Enter your username: </label>
                 <input type="text" id="username" name="username"><br><br>
                 <label for="password">Enter your password: </label>
                 <input type="password" id="password" name="password"><br><br>
                 <input type="submit" value="Login">
               </form>
             </div>
            `)
});

app.post('/login', (req, res) => {
    console.log("Received a POST /login request");
    const username = req.body.username;
    const password = req.body.password; 

    const result: User = db.users.find((user: User) => {
        return user.username === username && user.password === password;
    });

    if(result) {
        const jwtPromise = create({ alg: "HS512", typ: "JWT" }, 
                                  { username: result.username, exp: getNumericDate(2*60)}, result.password);
        jwtPromise.then( (jwt: string) => {
            result.jwt = jwt;
            res.setStatus(201);
            res.send(`
                     <div>
                       <h1>Here is your token</h1>
                       <p>${jwt}</p>
                     </div>
                    `);
            console.table(db.users);
        })
        .catch( (e: string) => {
            res.setStatus(500);
            res.send(`<h2>Oops, something bad had happend</h2>`);
            console.error(e);
        })
    }
    else {
        res.setStatus(404);
        res.send(`<div><h2>Sorry, user not found. Please try again or register.</h2></div>`);
    }
})

app.get('/articles', (req, res) => {
    console.log("Received GET /articles request...");

    const auth = req.headers.get("Authorization");
    if( !auth || auth === '') {
        res.setStatus(401);
        res.send(`<div><h1>Unauthorized access! Please login first!</h1></div>`);
    }
    else {
        const token = auth.split(' ')[1];
        const result = db.users.find((user: User) => {
            return user.jwt === token;
        });
        
        if(result) {
            const payloadPromise = verify(result.jwt, result.password, "HS512");
            payloadPromise.then( payload => {
                console.log("Payload: ", payload);
                const list = articles.news.map( (article: Article) => {
                    return `<li>${article.headlines}</li>`
                });
                let html = `<ul>`;
                for(let i = 0; i< list.length; i++) {
                    html += list[i];
                }
                html += '</ul>';

                res.send(`<div>
                           <h2>Today's news: </h2>
                           ${html}
                         </div>`)
            })
            .catch( e => {
                result.jwt = '';
                console.table(db.users);
                res.send(`<h2>JWT has expired! Please re-login!</h2>`);
                console.error(e);
            })
        }
        else {
            res.setStatus(404);
            res.send(`<h2>Error: No such user, please register!</h2>`);
        }
    }
})

app.listen(5000);