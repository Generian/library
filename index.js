const today = new Date()

function dateDiff(date1, date2) {
  //Get 1 day in milliseconds
  const one_day=1000*60*60*24;

  // Convert both dates to milliseconds
  var date1_ms = date1.getTime();
  var date2_ms = date2.getTime();

  // Calculate the difference in milliseconds
  var difference_ms = date2_ms - date1_ms;

  // Convert back to days and return
  return Math.round(difference_ms/one_day);
}

$.ajax({
  url: 'http://vpc-prod-project-info-zn5wnvz33xa6bt3puh2yfot5va.eu-west-1.es.amazonaws.com/read_project_info/_search',
  type: 'POST',
  data: JSON.stringify({
    "explain": true,
    "size": 100,
    "query": {
      "function_score": {
        "functions": [{
            "field_value_factor": {
              "field": "num_views",
              "factor": 0.25,
              "modifier": "sqrt",
              "missing": 1
            }
          },
          {
            "field_value_factor": {
              "field": "num_copies",
              "factor": 10,
              "modifier": "sqrt",
              "missing": 1
            }
          },
          {
            "field_value_factor": {
              "field": "num_likes",
              "factor": 8,
              "modifier": "sqrt",
              "missing": 1
            }
          },
          {
            "exp": {
              "created": {
                "scale": "80d",
                "offset": "10d",
                "decay": 0.5
              }
            }
          }
        ],
        "score_mode": "multiply"
      }
    }
  }),
  headers: {'Content-Type': 'application/json'},
  success: (resp) => {
    resp.hits.hits.forEach((proj) => {
      const p = proj._source;
      const created = new Date(p.created);
      var $skeleton = `<div class="project-item"><div class="project-thumb-item">    <div class="project-item-top">      <a class="project-image-wrapper" href="https://www.simscale.com/projects/${p.owner_name}/${p.public_project_name}/">            <img class="img-responsive" src="https://www.simscale.com${p.thumbnail_url}" alt="${p.thumbnail_url}">        </a>      <div class="project-permissions">      </div>      <a href="https://www.simscale.com/workbench/?pid=${p.project_id_ext}" class="btn btn-sm btn-primary open-project-link"><i class="fa fa-share" title="Open in your workbench"></i></a>    </div>    <div class="project-item-bottom">      <div class="project-item-body">        <table>          <tbody>            <tr>              <td>                <a href="https://www.simscale.com/projects/${p.owner_name}/${p.public_project_name}/">                            <p class="project-title">${p.project_name}</p>                        </a>              </td>            </tr>            <tr>              <td><a href="https://www.simscale.com/users/${p.owner_name}/" class="project-author">${p.owner_name}</a></td>            </tr>            <tr>              <td colspan="2">                <p class="project-info">${p.num_geometries} CAD model / ${p.num_meshes} mesh / ${p.num_simulations} simulation </p>              </td>            </tr>          </tbody>        </table>      </div>      <div class="project-item-footer">        <table>          <tbody>            <tr>              <td>                <p class="project-date">Created ${dateDiff(created, today)} days ago</p>              </td>              <td class="project-links">                <i class="fas fa-eye" title="Number of views"></i><span>${p.num_views}</span>                <i class="fas fa-heart" title="Number of likes"></i><span>${p.num_likes}</span>                <i class="fas fa-code-branch" title="Number of copies"></i><span>${p.num_copies}</span>              </td>            </tr>          </tbody>        </table>      </div>    </div>  </div></div>`;
      $('#projectsList').append($skeleton);
    })
  }
})