// Define
const defaultFunctions = [
  {
    "field_value_factor": {
        "field": "num_views",
        "factor": 2,
        "modifier": "log2p",
        "missing": 1
    }
  },
  {
    "field_value_factor": {
        "field": "num_copies",
        "factor": 4,
        "modifier": "sqrt",
        "missing": 1
    }
  },
  {
    "field_value_factor": {
        "field": "num_likes",
        "factor": 16,
        "modifier": "none",
        "missing": 1
    }
  },
  {
    "field_value_factor": {
        "field": "num_simulations_runs",
        "factor": 1,
        "modifier": "log2p",
        "missing": 1
    }
  },
  {
    "exp": {
        "created": {
            "scale": "500d",
            "offset": "10d",
            "decay": 0.1
        }
    }
  }
]

const defaultQuery = {
    "explain": true,
    "size": 100,
    "query": {
        "function_score": {
            "query": {
              "bool": {
                "must": {
                  "match_all": {}
                },
                "must_not": {
                  "match": {"project_name": "Tutorial"}
                },
                "filter": []
              }
            },
            "functions": defaultFunctions,
            "score_mode": "multiply"
        }
    }
}

function dateDiff(created) {
  const today = new Date()

  //Get 1 day in milliseconds
  const one_day=1000*60*60*24

  // Convert both dates to milliseconds
  const created_ms = created.getTime()
  const today_ms = today.getTime()

  // Calculate the difference in milliseconds
  const difference_ms = today_ms - created_ms
  const diff_months = today.getMonth() - created.getMonth()
  const diff_years = today.getFullYear() - created.getFullYear()

  // Convert back to days and return
  const age_in_days = Math.round(difference_ms/one_day)
  let age_string = ""

  if (age_in_days == 0) {
    age_string = "Created today"
  } else if (age_in_days == 1) {
    age_string = "Created yesterday"
  } else if (age_in_days < 14) {
    age_string = `Created ${age_in_days} days ago`
  } else if (age_in_days < 67) {
    age_string = `Created ${Math.round(age_in_days/7)} weeks ago`
  } else if (age_in_days >= 70) {
    if (diff_years == 0) {
      age_string = `Created ${diff_months} months ago`
    } else if (diff_years == 1) {
      age_string = "Created last year"
    } else {
      age_string = `Created ${diff_years} years ago`
    }
  } else {
    throw "Couldn't determine project age"
  }
  return age_string
}

function updateActiveState(id) {
  $("button#num_views").removeClass("active")
  $("button#num_likes").removeClass("active")
  $("button#num_copies").removeClass("active")
  $("button#created").removeClass("active")
  $("button#modified").removeClass("active")
  $(`button#${id}`).addClass("active")
}

function populateNew(newSearch = false, firstLoad = false) {
    let searchTerm = $("#searchByKeyword").val()
    let mode = $(".sortMode.active").attr('id')
    let timeframe = $(".timeFilter").val()

    if (newSearch) {
      searchTerm = $("#searchByKeyword").val()
      mode = ""
      timeframe = "all"
      updateActiveState('none')
      $(".timeFilter").val("all")
    }

    let data = {
        "explain": true,
        "size": 100,
        "sort" : [
    	    "_score"
        ],
        "query": {
            "function_score": {
                "query": {
                  "bool": {
                    "must": {
                      "match_all": {}
                    },
                    "filter": []
                  }
                },
                "functions": [],
                "score_mode": "sum"
            }
        }
    }

    if (searchTerm.slice(0,5) == "user:") {
      user = searchTerm.slice(5)
      searchTerm = ""
      data.query.function_score.query.bool.filter.push({ "term":  { "owner_name": user }})
      data.query.function_score.functions = defaultFunctions
    }

    if (searchTerm !== "") {
      data.query.function_score.query.bool.must = {
      	"match": {
      		"project_name": searchTerm
      	}
      }
      data.query.function_score.functions = defaultFunctions
    } else {
      data.query.function_score.query.bool.must = {
        "match_all": {}
      }
      data.query.function_score.query.bool.must_not = {
        "match": {"project_name": "Tutorial"}
      }
      data.query.function_score.functions = []
    }

    if (mode !== "") {
      updateActiveState(mode)
      data.sort = [
        { [mode] : {"order" : "desc"}},
        "_score"
      ]
    } else {
      data.sort = [
        "_score"
      ]
    }

    if (timeframe !== "all") {
      let d = new Date();
      d.setDate(d.getDate()-timeframe);
      data.query.function_score.query.bool.filter.push({"range": {"created": {"gte": d.toISOString()}}})
    }

    data = firstLoad ? defaultQuery : data
    console.log("Search query: ",data)

    $.ajax({
        url: 'https://vpc-prod-project-info-zn5wnvz33xa6bt3puh2yfot5va.eu-west-1.es.amazonaws.com/read_project_info/_search',
        type: 'POST',
        data: JSON.stringify(data),
        headers: {'Content-Type': 'application/json'},
        success: (resp) => {
            $('#projectsList').empty();
            resp.hits.hits.forEach((proj) => {
                // Extract project data. Not sure if we already have everything we need to populate the entire card. Should be added to ES if missing I guess
                const p = proj._source
                // Just a helper to calculate the # days since
                const $projectCard = `<div class="project-item">
                  <div class="project-thumb-item">
                    <div class="project-item-top"> <a class="project-image-wrapper" href="https://www.simscale.com/projects/${p.owner_name}/${p.public_project_name}/"> <img class="img-responsive" src="https://www.simscale.com${p.thumbnail_url}"
                          alt="${p.thumbnail_url}"> </a>
                      <div class="project-permissions"> </div> <a href="https://www.simscale.com/workbench/?pid=${p.project_id_ext}" class="btn btn-sm btn-primary open-project-link"><i class="fa fa-share" title="Open in your workbench"></i></a>
                    </div>
                    <div class="project-item-bottom">
                      <div class="project-item-body">
                        <table>
                          <tbody>
                            <tr>
                              <td> <a href="https://www.simscale.com/projects/${p.owner_name}/${p.public_project_name}/">
                                  <p class="project-title">${p.project_name}</p>
                                </a> </td>
                            </tr>
                            <tr>
                              <td><a href="https://www.simscale.com/users/${p.owner_name}/" class="project-author">${p.owner_name}</a></td>
                            </tr>
                            <tr>
                              <td colspan="2">
                                <p class="project-info">${p.num_geometries} CAD model / ${p.num_meshes} mesh / ${p.num_simulations} simulation </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div class="project-item-footer">
                        <table>
                          <tbody>
                            <tr>
                              <td>
                                <p class="project-date">${dateDiff(new Date(p.created))}</p>
                              </td>
                              <td class="project-links"> <i class="fas fa-eye" title="Number of views"></i><span>${p.num_views}</span> <i class="fas fa-heart" title="Number of likes"></i><span>${p.num_likes}</span> <i class="fas fa-code-branch"
                                  title="Number of copies"></i><span>${p.num_copies}</span> </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>`
                $('#projectsList').append($projectCard);
            })
        }
    })
}

// Fill page on page load
populateNew(false,true)
